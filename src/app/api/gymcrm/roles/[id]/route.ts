import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import { isGymRole } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdateRoleBody = {
  rol?: string;
  sede_id?: string | null;
  activo?: boolean;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext(['admin']);
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const { id } = await params;

  let body: UpdateRoleBody;
  try {
    body = await parseJsonBody<UpdateRoleBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, string | boolean | null> = {};

  if (body.rol !== undefined) {
    if (!isGymRole(body.rol)) {
      return fail('rol inválido.', 400);
    }
    payload.rol = body.rol;
  }

  if (body.sede_id !== undefined) payload.sede_id = body.sede_id;
  if (body.activo !== undefined) payload.activo = body.activo;

  if (Object.keys(payload).length === 0) {
    return fail('No hay campos para actualizar.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('usuarios_roles'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar rol: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const authCtx = await getAuthContext(['admin']);
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const { id } = await params;

  const { data, error } = await authCtx.client.database
    .from(gymTable('usuarios_roles'))
    .update({ activo: false })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo desactivar rol: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
