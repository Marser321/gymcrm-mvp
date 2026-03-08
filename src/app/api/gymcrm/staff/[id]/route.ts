import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import { isGymRole, type GymRole } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdateStaffBody = {
  rol?: string;
  email?: string | null;
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

const upsertProfile = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  payload: {
    userId: string;
    nombres?: string;
    apellidos?: string;
    telefono?: string | null;
    notas?: string | null;
  }
) => {
  const hasAnyProfileField =
    payload.nombres !== undefined ||
    payload.apellidos !== undefined ||
    payload.telefono !== undefined ||
    payload.notas !== undefined;

  if (!hasAnyProfileField) return;

  const current = await authCtx.client.database
    .from(gymTable('staff_perfiles'))
    .select('id, nombres, apellidos, telefono, notas')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('user_id', payload.userId)
    .maybeSingle();

  if (current.error) {
    if (isMissingRelation(current.error.message)) return;
    throw new Error(current.error.message);
  }

  if (current.data?.id) {
    const updatePayload = {
      nombres: payload.nombres?.trim() || current.data.nombres,
      apellidos: payload.apellidos?.trim() || current.data.apellidos,
      telefono: payload.telefono !== undefined ? payload.telefono : current.data.telefono,
      notas: payload.notas !== undefined ? payload.notas : current.data.notas,
    };

    const updated = await authCtx.client.database
      .from(gymTable('staff_perfiles'))
      .update(updatePayload)
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', current.data.id);

    if (updated.error) {
      throw new Error(updated.error.message);
    }
    return;
  }

  if (!payload.nombres?.trim() || !payload.apellidos?.trim()) {
    throw new Error('nombres y apellidos son obligatorios para crear perfil staff.');
  }

  const inserted = await authCtx.client.database
    .from(gymTable('staff_perfiles'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: payload.userId,
        nombres: payload.nombres.trim(),
        apellidos: payload.apellidos.trim(),
        telefono: payload.telefono ?? null,
        notas: payload.notas ?? null,
      },
    ]);

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext(['admin']);
  if (!authCtx.ok) return authCtx.response;

  const { id } = await params;

  let body: UpdateStaffBody;
  try {
    body = await parseJsonBody<UpdateStaffBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (body.rol !== undefined) {
    if (!isGymRole(body.rol) || body.rol === 'cliente') {
      return fail('rol inválido para staff.', 400, 'invalid_staff_role');
    }
  }

  const roleRecord = await authCtx.client.database
    .from(gymTable('usuarios_roles'))
    .select('id, user_id, email, rol, sede_id, activo, created_at, updated_at')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .maybeSingle();

  if (roleRecord.error || !roleRecord.data) {
    return fail(`Staff no encontrado: ${roleRecord.error?.message ?? 'not found'}`, 404, 'staff_not_found');
  }

  const rolePayload: Record<string, string | boolean | null> = {};
  if (body.rol !== undefined) rolePayload.rol = body.rol as GymRole;
  if (body.email !== undefined) rolePayload.email = body.email?.trim() || null;
  if (body.sede_id !== undefined) rolePayload.sede_id = body.sede_id;
  if (body.activo !== undefined) rolePayload.activo = body.activo;

  if (
    Object.keys(rolePayload).length === 0 &&
    body.nombres === undefined &&
    body.apellidos === undefined &&
    body.telefono === undefined &&
    body.notas === undefined
  ) {
    return fail('No hay campos para actualizar.', 400);
  }

  let updatedRole = roleRecord.data;

  if (Object.keys(rolePayload).length > 0) {
    const updated = await authCtx.client.database
      .from(gymTable('usuarios_roles'))
      .update(rolePayload)
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', id)
      .select('id, user_id, email, rol, sede_id, activo, created_at, updated_at')
      .single();

    if (updated.error || !updated.data) {
      return fail(`No se pudo actualizar staff: ${updated.error?.message ?? 'unknown error'}`, 500, 'staff_update_failed');
    }

    updatedRole = updated.data;
  }

  try {
    await upsertProfile(authCtx, {
      userId: updatedRole.user_id,
      nombres: body.nombres,
      apellidos: body.apellidos,
      telefono: body.telefono,
      notas: body.notas,
    });
  } catch (error) {
    return fail(
      error instanceof Error ? `No se pudo actualizar perfil staff: ${error.message}` : 'No se pudo actualizar perfil staff.',
      500,
      'staff_profile_update_failed'
    );
  }

  const profile = await authCtx.client.database
    .from(gymTable('staff_perfiles'))
    .select('nombres, apellidos, telefono, notas')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('user_id', updatedRole.user_id)
    .maybeSingle();

  const fallbackNames = {
    nombres: 'Staff',
    apellidos: 'Demo',
  };

  return ok({
    ...updatedRole,
    nombres: profile.data?.nombres ?? body.nombres?.trim() ?? fallbackNames.nombres,
    apellidos: profile.data?.apellidos ?? body.apellidos?.trim() ?? fallbackNames.apellidos,
    telefono: profile.data?.telefono ?? body.telefono ?? null,
    notas: profile.data?.notas ?? body.notas ?? null,
  });
}

export async function DELETE(_: Request, { params }: Params) {
  const authCtx = await getAuthContext(['admin']);
  if (!authCtx.ok) return authCtx.response;

  const { id } = await params;

  const updated = await authCtx.client.database
    .from(gymTable('usuarios_roles'))
    .update({ activo: false })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('id, user_id, email, rol, sede_id, activo, created_at, updated_at')
    .maybeSingle();

  if (updated.error || !updated.data) {
    return fail(`No se pudo desactivar staff: ${updated.error?.message ?? 'unknown error'}`, 500, 'staff_disable_failed');
  }

  return ok(updated.data);
}
