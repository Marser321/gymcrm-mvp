import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FullConfig } from '@playwright/test';
import { createClient } from '@insforge/sdk';

type MePayload = {
  data?: {
    ready?: boolean;
    auth?: {
      userId?: string;
      email?: string | null;
    };
    role?: {
      gimnasio_id?: string;
      rol?: string;
    } | null;
    cliente?: {
      id?: string;
    } | null;
  };
  error?: {
    message?: string;
  };
};

type SeedOutput = {
  generatedAt: string;
  baseURL: string;
  seedEnabled: boolean;
  staffCookie: string;
  clientCookie: string;
  gimnasioId?: string;
  clientId?: string;
  roleAligned?: boolean;
};

const getBaseURL = (config: FullConfig): string => {
  const fromProject = config.projects?.[0]?.use?.baseURL;
  if (typeof fromProject === 'string' && fromProject.length > 0) return fromProject;
  return process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';
};

const parseCookieHeader = (response: Response): string => {
  const getter = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookieHeaders = getter?.call(response.headers) ?? [];
  const fallbackHeader = response.headers.get('set-cookie');
  const fallbackList = fallbackHeader
    ? fallbackHeader.split(/,(?=[^;,\s]+=)/g).map((entry) => entry.trim())
    : [];
  const mergedHeaders = cookieHeaders.length > 0 ? cookieHeaders : fallbackList;
  const pairs = mergedHeaders
    .map((entry) => entry.split(';')[0]?.trim())
    .filter((entry): entry is string => Boolean(entry && entry.includes('=')));

  return pairs.join('; ');
};

const jsonOrText = async (response: Response): Promise<string> => {
  const text = await response.text();
  if (!text) return '';

  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed);
  } catch {
    return text;
  }
};

const signInAndGetCookie = async (baseURL: string, email: string, password: string): Promise<string> => {
  const response = await fetch(`${baseURL}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'sign-in',
      email,
      password,
    }),
  });

  if (!response.ok) {
    const body = await jsonOrText(response);
    throw new Error(`No se pudo iniciar sesión para ${email}. status=${response.status}. body=${body}`);
  }

  const cookie = parseCookieHeader(response);
  if (!cookie) {
    throw new Error(`Login OK para ${email} pero sin Set-Cookie en /api/auth.`);
  }
  return cookie;
};

const fetchMe = async (baseURL: string, cookieHeader: string): Promise<MePayload> => {
  const response = await fetch(`${baseURL}/api/gymcrm/me`, {
    headers: {
      cookie: cookieHeader,
    },
  });

  if (!response.ok) {
    const body = await jsonOrText(response);
    throw new Error(`No se pudo consultar /api/gymcrm/me. status=${response.status}. body=${body}`);
  }

  return (await response.json()) as MePayload;
};

const ensureBootstrap = async (baseURL: string, cookieHeader: string): Promise<void> => {
  const response = await fetch(`${baseURL}/api/gymcrm/bootstrap`, {
    method: 'POST',
    headers: {
      cookie: cookieHeader,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      nombreGym: process.env.E2E_STAFF_GYM_NAME ?? 'Gym E2E',
      nombreSede: process.env.E2E_STAFF_SEDE_NAME ?? 'Sede E2E',
    }),
  });

  if (!response.ok) {
    const body = await jsonOrText(response);
    throw new Error(`Falló bootstrap staff. status=${response.status}. body=${body}`);
  }
};

const ensureClientAlignment = async ({
  baseURL,
  adminApiKey,
  staffGymId,
  clientUserId,
  clientEmail,
}: {
  baseURL: string;
  adminApiKey: string;
  staffGymId: string;
  clientUserId: string;
  clientEmail: string;
}) => {
  const admin = createClient({
    baseUrl: baseURL,
    anonKey: adminApiKey,
  });

  const forceRoleGym = process.env.E2E_SEED_FORCE_ROLE_GYM !== 'false';

  if (forceRoleGym) {
    await admin.database
      .from('gymcrm_usuarios_roles')
      .update({ activo: false })
      .eq('user_id', clientUserId)
      .neq('gimnasio_id', staffGymId)
      .eq('activo', true);
  }

  const currentRole = await admin.database
    .from('gymcrm_usuarios_roles')
    .select('id, activo')
    .eq('gimnasio_id', staffGymId)
    .eq('user_id', clientUserId)
    .eq('rol', 'cliente')
    .limit(1)
    .maybeSingle();

  if (currentRole.error) {
    throw new Error(`No se pudo validar rol cliente en gym staff: ${currentRole.error.message}`);
  }

  if (!currentRole.data) {
    const insertRole = await admin.database.from('gymcrm_usuarios_roles').insert([
      {
        gimnasio_id: staffGymId,
        user_id: clientUserId,
        email: clientEmail,
        rol: 'cliente',
        activo: true,
      },
    ]);

    if (insertRole.error) {
      throw new Error(`No se pudo crear rol cliente E2E: ${insertRole.error.message}`);
    }
  } else if (!currentRole.data.activo) {
    const activateRole = await admin.database
      .from('gymcrm_usuarios_roles')
      .update({ activo: true })
      .eq('id', currentRole.data.id);

    if (activateRole.error) {
      throw new Error(`No se pudo reactivar rol cliente E2E: ${activateRole.error.message}`);
    }
  }

  const cliente = await admin.database
    .from('gymcrm_clientes')
    .select('id')
    .eq('gimnasio_id', staffGymId)
    .eq('auth_user_id', clientUserId)
    .limit(1)
    .maybeSingle();

  if (cliente.error) {
    throw new Error(`No se pudo consultar cliente E2E: ${cliente.error.message}`);
  }

  let clienteId = cliente.data?.id as string | undefined;

  if (!clienteId) {
    const insertClient = await admin.database
      .from('gymcrm_clientes')
      .insert([
        {
          gimnasio_id: staffGymId,
          auth_user_id: clientUserId,
          nombres: 'Cliente',
          apellidos: 'E2E',
          email: clientEmail,
          estado: 'activo',
        },
      ])
      .select('id')
      .single();

    if (insertClient.error || !insertClient.data?.id) {
      throw new Error(`No se pudo crear cliente E2E: ${insertClient.error?.message ?? 'unknown error'}`);
    }

    clienteId = insertClient.data.id as string;
  }

  const plan = await admin.database
    .from('gymcrm_planes_membresia')
    .select('id')
    .eq('gimnasio_id', staffGymId)
    .eq('activo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (plan.error || !plan.data?.id) {
    throw new Error(`No existe plan activo para seed E2E: ${plan.error?.message ?? 'none'}`);
  }

  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const activeMembership = await admin.database
    .from('gymcrm_membresias')
    .select('id')
    .eq('gimnasio_id', staffGymId)
    .eq('cliente_id', clienteId)
    .eq('estado', 'activa')
    .lte('fecha_inicio', start)
    .gte('fecha_fin', start)
    .limit(1)
    .maybeSingle();

  if (activeMembership.error) {
    throw new Error(`No se pudo validar membresía activa cliente E2E: ${activeMembership.error.message}`);
  }

  if (!activeMembership.data?.id) {
    const insertMembership = await admin.database.from('gymcrm_membresias').insert([
      {
        gimnasio_id: staffGymId,
        cliente_id: clienteId,
        plan_id: plan.data.id as string,
        estado: 'activa',
        fecha_inicio: start,
        fecha_fin: end,
      },
    ]);

    if (insertMembership.error) {
      throw new Error(`No se pudo crear membresía activa E2E: ${insertMembership.error.message}`);
    }
  }
};

const writeSeedOutput = (outputFile: string, payload: SeedOutput) => {
  const abs = resolve(process.cwd(), outputFile);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(payload, null, 2), 'utf-8');
};

async function globalSetup(config: FullConfig) {
  const baseURL = getBaseURL(config);
  const outputFile = process.env.E2E_SEED_OUTPUT ?? '.playwright-artifacts/e2e-seed.json';
  const seedEnabled = process.env.E2E_SEED_ENABLED === 'true';
  const dataMode = (process.env.GYMCRM_DATA_MODE ?? process.env.NEXT_PUBLIC_GYMCRM_DATA_MODE ?? 'demo').trim();
  const useOpenSession = process.env.E2E_OPEN_SESSION !== 'false';

  const fromEnvStaff = (process.env.E2E_STAFF_COOKIE ?? (dataMode === 'demo' ? 'gymcrm_open_role=admin' : '')).trim();
  const fromEnvClient = (process.env.E2E_CLIENT_COOKIE ?? (dataMode === 'demo' ? 'gymcrm_open_role=cliente' : '')).trim();

  if (useOpenSession) {
    const staffCookieRaw = process.env.E2E_STAFF_COOKIE ?? fromEnvStaff;
    const clientCookieRaw = process.env.E2E_CLIENT_COOKIE ?? fromEnvClient;
    const staffCookie = (staffCookieRaw || 'gymcrm_open_role=admin').trim();
    const clientCookie = (clientCookieRaw || 'gymcrm_open_role=cliente').trim();

    try {
      await ensureBootstrap(baseURL, staffCookie);
    } catch {
      // Bootstrap is best-effort in open mode.
    }

    let openClientId = '';
    try {
      const me = await fetchMe(baseURL, clientCookie);
      openClientId = me.data?.cliente?.id ?? '';
    } catch {
      openClientId = '';
    }

    process.env.E2E_STAFF_COOKIE = staffCookie;
    process.env.E2E_CLIENT_COOKIE = clientCookie;

    writeSeedOutput(outputFile, {
      generatedAt: new Date().toISOString(),
      baseURL,
      seedEnabled,
      staffCookie,
      clientCookie,
      clientId: openClientId || undefined,
      roleAligned: true,
    });
    return;
  }

  if (dataMode === 'demo') {
    let demoClientId = '';
    try {
      const me = await fetchMe(baseURL, fromEnvClient);
      demoClientId = me.data?.cliente?.id ?? '';
    } catch {
      demoClientId = '';
    }

    process.env.E2E_STAFF_COOKIE = fromEnvStaff;
    process.env.E2E_CLIENT_COOKIE = fromEnvClient;

    writeSeedOutput(outputFile, {
      generatedAt: new Date().toISOString(),
      baseURL,
      seedEnabled,
      staffCookie: fromEnvStaff,
      clientCookie: fromEnvClient,
      clientId: demoClientId || undefined,
      roleAligned: true,
    });
    return;
  }

  if (!seedEnabled) {
    writeSeedOutput(outputFile, {
      generatedAt: new Date().toISOString(),
      baseURL,
      seedEnabled: false,
      staffCookie: fromEnvStaff,
      clientCookie: fromEnvClient,
    });
    return;
  }

  const staffEmail = (process.env.E2E_STAFF_EMAIL ?? '').trim();
  const staffPassword = (process.env.E2E_STAFF_PASSWORD ?? '').trim();
  const clientEmail = (process.env.E2E_CLIENT_EMAIL ?? '').trim();
  const clientPassword = (process.env.E2E_CLIENT_PASSWORD ?? '').trim();

  if (!staffEmail || !staffPassword || !clientEmail || !clientPassword) {
    throw new Error(
      'E2E_SEED_ENABLED=true requiere E2E_STAFF_EMAIL, E2E_STAFF_PASSWORD, E2E_CLIENT_EMAIL y E2E_CLIENT_PASSWORD.'
    );
  }

  const staffCookie = await signInAndGetCookie(baseURL, staffEmail, staffPassword);
  await ensureBootstrap(baseURL, staffCookie);

  const staffMe = await fetchMe(baseURL, staffCookie);
  const staffGymId = staffMe.data?.role?.gimnasio_id ?? '';
  if (!staffGymId) {
    throw new Error('No se pudo resolver gimnasio del staff luego de bootstrap.');
  }

  const clientCookie = await signInAndGetCookie(baseURL, clientEmail, clientPassword);
  const clientMe = await fetchMe(baseURL, clientCookie);

  const clientUserId = clientMe.data?.auth?.userId ?? '';
  if (!clientUserId) {
    throw new Error('No se pudo resolver userId del cliente E2E.');
  }

  const roleAligned = clientMe.data?.role?.gimnasio_id === staffGymId && Boolean(clientMe.data?.cliente?.id);

  if (!roleAligned) {
    const adminApiKey = (process.env.E2E_ADMIN_API_KEY ?? '').trim();
    if (!adminApiKey) {
      throw new Error(
        'Cliente E2E no está alineado al gym del staff y falta E2E_ADMIN_API_KEY para seed automático.'
      );
    }

    await ensureClientAlignment({
      baseURL,
      adminApiKey,
      staffGymId,
      clientUserId,
      clientEmail,
    });
  }

  const clientMeFinal = await fetchMe(baseURL, clientCookie);
  const finalClientGym = clientMeFinal.data?.role?.gimnasio_id ?? '';
  const finalClientId = clientMeFinal.data?.cliente?.id ?? '';

  if (finalClientGym !== staffGymId || !finalClientId) {
    throw new Error(
      `Seed E2E incompleto: cliente en gym=${finalClientGym || 'none'} clienteId=${finalClientId || 'none'} staffGym=${staffGymId}`
    );
  }

  process.env.E2E_STAFF_COOKIE = staffCookie;
  process.env.E2E_CLIENT_COOKIE = clientCookie;

  writeSeedOutput(outputFile, {
    generatedAt: new Date().toISOString(),
    baseURL,
    seedEnabled: true,
    staffCookie,
    clientCookie,
    gimnasioId: staffGymId,
    clientId: finalClientId,
    roleAligned: true,
  });
}

export default globalSetup;
