import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const { id } = await params;
  const query = authCtx.client.database
    .from(gymTable('clientes'))
    .select('*')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id);

  if (authCtx.context.role === 'cliente') {
    query.eq('auth_user_id', authCtx.authUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return fail(`No se pudo cargar cliente: ${error.message}`, 500);
  }

  if (!data) {
    return fail('Cliente no encontrado.', 404);
  }

  return ok(data);
}

type UpdateClienteBody = {
  sede_id?: string | null;
  auth_user_id?: string | null;
  nombres?: string;
  apellidos?: string;
  email?: string | null;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  objetivo?: string | null;
  estado?: 'activo' | 'inactivo' | 'suspendido';
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clientes)) {
    return fail('No tienes permisos para editar clientes.', 403);
  }

  const { id } = await params;

  let body: UpdateClienteBody;
  try {
    body = await parseJsonBody<UpdateClienteBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, string | null> = {};

  if (body.sede_id !== undefined) payload.sede_id = body.sede_id;
  if (body.auth_user_id !== undefined) payload.auth_user_id = body.auth_user_id;
  if (body.nombres !== undefined) payload.nombres = body.nombres.trim();
  if (body.apellidos !== undefined) payload.apellidos = body.apellidos.trim();
  if (body.email !== undefined) payload.email = body.email ? body.email.trim() : null;
  if (body.telefono !== undefined) payload.telefono = body.telefono ? body.telefono.trim() : null;
  if (body.fecha_nacimiento !== undefined) payload.fecha_nacimiento = body.fecha_nacimiento;
  if (body.objetivo !== undefined) payload.objetivo = body.objetivo ? body.objetivo.trim() : null;
  if (body.estado !== undefined) payload.estado = body.estado;

  if (Object.keys(payload).length === 0) {
    return fail('No hay campos para actualizar.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('clientes'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar cliente: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clientes)) {
    return fail('No tienes permisos para desactivar clientes.', 403);
  }

  const { id } = await params;

  const { data, error } = await authCtx.client.database
    .from(gymTable('clientes'))
    .update({ estado: 'inactivo' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo desactivar cliente: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
