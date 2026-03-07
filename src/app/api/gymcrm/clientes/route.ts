import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';
import type { Cliente } from '@/lib/gymcrm/types';

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim();
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('clientes'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (authCtx.context.role === 'cliente') {
    query.eq('auth_user_id', authCtx.authUserId);
  }

  if (status) {
    query.eq('estado', status);
  }

  if (search.length > 0) {
    const pattern = `%${search}%`;
    query.or(`nombres.ilike.${pattern},apellidos.ilike.${pattern},email.ilike.${pattern},telefono.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar clientes: ${error.message}`, 500);
  }

  return okList((data as Cliente[]) ?? [], count ?? 0);
}

type CreateClienteBody = {
  sede_id?: string | null;
  auth_user_id?: string | null;
  nombres: string;
  apellidos: string;
  email?: string | null;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  objetivo?: string | null;
  estado?: 'activo' | 'inactivo' | 'suspendido';
};

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clientes)) {
    return fail('No tienes permisos para crear clientes.', 403);
  }

  let body: CreateClienteBody;
  try {
    body = await parseJsonBody<CreateClienteBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.nombres?.trim() || !body.apellidos?.trim()) {
    return fail('nombres y apellidos son obligatorios.', 400);
  }

  const payload = {
    gimnasio_id: authCtx.context.gimnasioId,
    sede_id: body.sede_id ?? null,
    auth_user_id: body.auth_user_id ?? null,
    nombres: body.nombres.trim(),
    apellidos: body.apellidos.trim(),
    email: body.email?.trim() || null,
    telefono: body.telefono?.trim() || null,
    fecha_nacimiento: body.fecha_nacimiento || null,
    objetivo: body.objetivo?.trim() || null,
    estado: body.estado ?? 'activo',
  };

  const { data, error } = await authCtx.client.database
    .from(gymTable('clientes'))
    .insert([payload])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear cliente: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
