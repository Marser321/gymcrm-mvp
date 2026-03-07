import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdateConsultaBody = {
  estado?: 'abierta' | 'seguimiento' | 'cerrada';
  asunto?: string;
  mensaje?: string;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const canEdit = hasRole(authCtx.context.role, PERMISSIONS.nutricion) || authCtx.context.role === 'cliente';
  if (!canEdit) {
    return fail('No tienes permisos para actualizar consultas.', 403);
  }

  const { id } = await params;

  let body: UpdateConsultaBody;
  try {
    body = await parseJsonBody<UpdateConsultaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const updatePayload: Record<string, string> = {};
  if (body.estado !== undefined) updatePayload.estado = body.estado;
  if (body.asunto !== undefined) updatePayload.asunto = body.asunto.trim();

  let consultaData: Record<string, unknown> | null = null;

  if (Object.keys(updatePayload).length > 0) {
    const { data, error } = await authCtx.client.database
      .from(gymTable('nutricion_consultas'))
      .update(updatePayload)
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      return fail(`No se pudo actualizar consulta: ${error?.message ?? 'unknown error'}`, 500);
    }

    consultaData = data;
  }

  let messageData: Record<string, unknown> | null = null;
  if (body.mensaje?.trim()) {
    const { data, error } = await authCtx.client.database
      .from(gymTable('nutricion_mensajes'))
      .insert([
        {
          consulta_id: id,
          autor_user_id: authCtx.authUserId,
          mensaje: body.mensaje.trim(),
        },
      ])
      .select('*')
      .single();

    if (error || !data) {
      return fail(`No se pudo agregar mensaje: ${error?.message ?? 'unknown error'}`, 500);
    }

    messageData = data;
  }

  if (!consultaData && !messageData) {
    return fail('No hay cambios para aplicar.', 400);
  }

  return ok({
    consulta: consultaData,
    mensaje: messageData,
  });
}
