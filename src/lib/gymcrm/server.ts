import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { apiErrorEnvelope } from '@/lib/gymcrm/api';
import {
  DEFAULT_GYM_ID,
  getGymcrmDataMode,
  readOpenRoleFromCookieHeader,
  type OpenRole,
} from '@/lib/gymcrm/open-session';
import type { GymContext, GymRole, UsuarioRol } from '@/lib/gymcrm/types';

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!BASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_INSFORGE_BASE_URL environment variable.');
}

// InsForge PostgREST currently serves `public` schema only.
// We expose gymcrm domain tables through `public.gymcrm_<table>` views.
export const gymTable = (table: string): string => `gymcrm_${table}`;

type ErrorResponse = ReturnType<typeof NextResponse.json>;

type AuthContextResult =
  | {
      ok: true;
      client: ReturnType<typeof createClient>;
      authUserId: string;
      context: GymContext;
      roleRecord: UsuarioRol;
    }
  | {
      ok: false;
      response: ErrorResponse;
    };

export const jsonError = (message: string, status = 400, code = 'bad_request', details?: unknown): ErrorResponse => {
  return NextResponse.json({ error: apiErrorEnvelope(message, code, details) }, { status });
};

const buildClient = () => {
  if (ANON_KEY) {
    return createClient({
      baseUrl: BASE_URL,
      anonKey: ANON_KEY,
    });
  }

  // Fallback for environments where anon key is injected through another channel.
  return createClient({
    baseUrl: BASE_URL,
  });
};

const resolveOpenUserId = (role: OpenRole): string => {
  if (role === 'cliente') {
    return process.env.GYMCRM_OPEN_CLIENT_AUTH_USER_ID?.trim() || 'open-cliente';
  }

  if (role === 'nutricionista') {
    return process.env.GYMCRM_OPEN_NUTRI_AUTH_USER_ID?.trim() || 'open-nutricionista';
  }

  return `open-${role}`;
};

const readRoleFromRequest = async (request?: Request): Promise<OpenRole> => {
  if (request) {
    return readOpenRoleFromCookieHeader(request.headers.get('cookie'));
  }

  const headerStore = await headers();
  return readOpenRoleFromCookieHeader(headerStore.get('cookie'));
};

const resolveDefaultGymId = async (client: ReturnType<typeof createClient>): Promise<string> => {
  if (process.env.GYMCRM_OPEN_GYM_ID?.trim()) {
    return process.env.GYMCRM_OPEN_GYM_ID.trim();
  }

  if (getGymcrmDataMode() !== 'live') {
    return DEFAULT_GYM_ID;
  }

  try {
    const { data, error } = await client.database
      .from(gymTable('gimnasios'))
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) {
      return DEFAULT_GYM_ID;
    }

    return String(data.id);
  } catch {
    return DEFAULT_GYM_ID;
  }
};

export const getAuthContext = async (requiredRoles?: GymRole[], request?: Request): Promise<AuthContextResult> => {
  const role = await readRoleFromRequest(request);
  const authUserId = resolveOpenUserId(role);
  const client = buildClient();
  const gimnasioId = await resolveDefaultGymId(client);

  if (requiredRoles && !requiredRoles.includes(role)) {
    return {
      ok: false,
      response: jsonError('No tienes permisos para esta operación.', 403, 'forbidden'),
    };
  }

  const now = new Date().toISOString();
  const roleRecord: UsuarioRol = {
    id: `open-role-${role}`,
    gimnasio_id: gimnasioId,
    user_id: authUserId,
    email: `${role}@gymcrm.open`,
    rol: role,
    activo: true,
    created_at: now,
    updated_at: now,
  };

  return {
    ok: true,
    client,
    authUserId,
    context: {
      gimnasioId,
      role,
      userId: authUserId,
    },
    roleRecord,
  };
};

export const parsePagination = (searchParams: URLSearchParams) => {
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 100 ? Math.floor(pageSize) : 20;

  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  return { page: safePage, pageSize: safeSize, from, to };
};

export const resolveGymId = (searchParams: URLSearchParams, defaultGymId: string) => {
  return searchParams.get('gimnasioId') ?? defaultGymId;
};
