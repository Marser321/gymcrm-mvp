import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { canManageStaff } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';
import { GYM_ROLES, isGymRole, type GymRole } from '@/lib/gymcrm/types';

const STAFF_ROLES: GymRole[] = GYM_ROLES.filter((role) => role !== 'cliente');

type StaffRoleRow = {
  id: string;
  user_id: string;
  email: string | null;
  rol: GymRole;
  sede_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

type StaffProfileRow = {
  id: string;
  user_id: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  notas: string | null;
};

type StaffPayload = {
  user_id?: string;
  email?: string | null;
  rol: string;
  sede_id?: string | null;
  activo?: boolean;
  nombres?: string;
  apellidos?: string;
  telefono?: string | null;
  notas?: string | null;
};

const isMissingRelation = (message?: string | null): boolean => {
  if (!message) return false;
  return /relation .* does not exist/i.test(message);
};

const normalizeUserId = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
};

const roleLabel = (role: GymRole): string => {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'recepcion':
      return 'Recepcion';
    case 'entrenador':
      return 'Entrenador';
    case 'nutricionista':
      return 'Nutricionista';
    default:
      return 'Staff';
  }
};

const fallbackNamesFromUserId = (userId: string) => {
  const clean = userId.replace(/[-_]/g, ' ').trim();
  if (!clean) {
    return {
      nombres: 'Staff',
      apellidos: 'Demo',
    };
  }

  const words = clean
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return {
    nombres: words.slice(0, 2).join(' ') || 'Staff',
    apellidos: words.slice(2).join(' ') || 'Demo',
  };
};

const mergeStaffRows = (roles: StaffRoleRow[], profiles: StaffProfileRow[]) => {
  const profileByUser = new Map<string, StaffProfileRow>();
  for (const profile of profiles) {
    profileByUser.set(profile.user_id, profile);
  }

  return roles.map((role) => {
    const profile = profileByUser.get(role.user_id);
    const fallback = fallbackNamesFromUserId(role.user_id);

    return {
      id: role.id,
      user_id: role.user_id,
      email: role.email,
      rol: role.rol,
      sede_id: role.sede_id,
      activo: role.activo,
      nombres: profile?.nombres ?? fallback.nombres,
      apellidos: profile?.apellidos ?? fallback.apellidos,
      telefono: profile?.telefono ?? null,
      notas: profile?.notas ?? null,
      created_at: role.created_at,
      updated_at: role.updated_at,
    };
  });
};

const upsertStaffProfile = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  payload: {
    userId: string;
    nombres: string;
    apellidos: string;
    telefono?: string | null;
    notas?: string | null;
  }
) => {
  const existing = await authCtx.client.database
    .from(gymTable('staff_perfiles'))
    .select('id')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('user_id', payload.userId)
    .maybeSingle();

  if (existing.error) {
    if (isMissingRelation(existing.error.message)) {
      return { persisted: false as const, reason: 'table_missing' as const };
    }
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    const updated = await authCtx.client.database
      .from(gymTable('staff_perfiles'))
      .update({
        nombres: payload.nombres,
        apellidos: payload.apellidos,
        telefono: payload.telefono ?? null,
        notas: payload.notas ?? null,
      })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', existing.data.id)
      .select('*')
      .maybeSingle();

    if (updated.error) {
      throw new Error(updated.error.message);
    }

    return { persisted: true as const, data: updated.data ?? null };
  }

  const inserted = await authCtx.client.database
    .from(gymTable('staff_perfiles'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: payload.userId,
        nombres: payload.nombres,
        apellidos: payload.apellidos,
        telefono: payload.telefono ?? null,
        notas: payload.notas ?? null,
      },
    ])
    .select('*')
    .maybeSingle();

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  return { persisted: true as const, data: inserted.data ?? null };
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!canManageStaff(authCtx.context.role)) {
    return fail('Solo admin puede gestionar staff.', 403, 'forbidden');
  }

  const url = new URL(request.url);
  const active = url.searchParams.get('active');
  const { from, to } = parsePagination(url.searchParams);

  const rolesQuery = authCtx.client.database
    .from(gymTable('usuarios_roles'))
    .select('id, user_id, email, rol, sede_id, activo, created_at, updated_at', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .in('rol', STAFF_ROLES)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (active === 'true') rolesQuery.eq('activo', true);
  if (active === 'false') rolesQuery.eq('activo', false);

  const rolesResult = await rolesQuery;
  if (rolesResult.error) {
    return fail(`No se pudo cargar staff: ${rolesResult.error.message}`, 500, 'staff_list_failed');
  }

  const roles = (rolesResult.data ?? []) as StaffRoleRow[];
  if (roles.length === 0) {
    return okList([], rolesResult.count ?? 0);
  }

  const userIds = Array.from(new Set(roles.map((row) => row.user_id)));
  const profileResult = await authCtx.client.database
    .from(gymTable('staff_perfiles'))
    .select('id, user_id, nombres, apellidos, telefono, notas')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .in('user_id', userIds);

  if (profileResult.error && !isMissingRelation(profileResult.error.message)) {
    return fail(`No se pudieron cargar perfiles de staff: ${profileResult.error.message}`, 500, 'staff_profile_list_failed');
  }

  const merged = mergeStaffRows(roles, (profileResult.data ?? []) as StaffProfileRow[]);
  return okList(merged, rolesResult.count ?? merged.length);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext(['admin']);
  if (!authCtx.ok) return authCtx.response;

  let body: StaffPayload;
  try {
    body = await parseJsonBody<StaffPayload>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!isGymRole(body.rol) || body.rol === 'cliente') {
    return fail('rol inválido para staff.', 400, 'invalid_staff_role');
  }

  const userIdSource = body.user_id?.trim() || `staff-${body.rol}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const userId = normalizeUserId(userIdSource);
  if (!userId) {
    return fail('user_id inválido para staff.', 400, 'invalid_user_id');
  }

  const nombres = body.nombres?.trim() || roleLabel(body.rol);
  const apellidos = body.apellidos?.trim() || 'Demo';

  try {
    await upsertStaffProfile(authCtx, {
      userId,
      nombres,
      apellidos,
      telefono: body.telefono ?? null,
      notas: body.notas ?? null,
    });
  } catch (error) {
    return fail(
      error instanceof Error ? `No se pudo guardar perfil staff: ${error.message}` : 'No se pudo guardar perfil staff.',
      500,
      'staff_profile_upsert_failed'
    );
  }

  const roleInsert = await authCtx.client.database
    .from(gymTable('usuarios_roles'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: userId,
        email: body.email?.trim() || null,
        rol: body.rol,
        sede_id: body.sede_id ?? null,
        activo: body.activo ?? true,
      },
    ])
    .select('id, user_id, email, rol, sede_id, activo, created_at, updated_at')
    .single();

  if (roleInsert.error || !roleInsert.data) {
    const duplicate = /duplicate key value|unique/i.test(roleInsert.error?.message ?? '');
    return fail(
      duplicate
        ? 'Ya existe ese rol para este usuario dentro del gimnasio.'
        : `No se pudo crear staff: ${roleInsert.error?.message ?? 'unknown error'}`,
      duplicate ? 409 : 500,
      duplicate ? 'staff_role_duplicate' : 'staff_create_failed'
    );
  }

  const merged = mergeStaffRows([roleInsert.data as StaffRoleRow], [
    {
      id: 'virtual',
      user_id: userId,
      nombres,
      apellidos,
      telefono: body.telefono ?? null,
      notas: body.notas ?? null,
    },
  ]);

  return ok(merged[0], { status: 201 });
}
