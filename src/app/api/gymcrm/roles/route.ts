import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { canManageStaff } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';
import { isGymRole } from '@/lib/gymcrm/types';

type CreateRoleBody = {
  user_id: string;
  email?: string | null;
  rol: string;
  sede_id?: string | null;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!canManageStaff(authCtx.context.role)) {
    return fail('Solo admin puede ver roles.', 403);
  }

  const url = new URL(request.url);
  const { from, to } = parsePagination(url.searchParams);

  const { data, error, count } = await authCtx.client.database
    .from(gymTable('usuarios_roles'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return fail(`No se pudieron cargar roles: ${error.message}`, 500);
  }

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext(['admin']);
  if (!authCtx.ok) {
    return authCtx.response;
  }

  let body: CreateRoleBody;
  try {
    body = await parseJsonBody<CreateRoleBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.user_id || !body.rol) {
    return fail('user_id y rol son obligatorios.', 400);
  }

  if (!isGymRole(body.rol)) {
    return fail('rol inválido.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('usuarios_roles'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        sede_id: body.sede_id ?? null,
        user_id: body.user_id,
        email: body.email ?? null,
        rol: body.rol,
        activo: true,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear rol: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
