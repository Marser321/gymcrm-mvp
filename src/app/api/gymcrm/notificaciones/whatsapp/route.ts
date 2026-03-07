import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type WhatsAppRequestBody = {
  to: string;
  template?: string;
  message: string;
  context?: Record<string, unknown>;
  scheduleAt?: string;
};

const META_API_URL = process.env.META_WHATSAPP_API_URL;
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;

const sendToMeta = async (body: WhatsAppRequestBody) => {
  if (!META_API_URL || !META_TOKEN) {
    return {
      sent: false,
      provider: 'meta-cloud-api',
      reason: 'missing_env',
      response: null,
    } as const;
  }

  const response = await fetch(META_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${META_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: body.to,
      type: 'text',
      text: { body: body.message },
      context: body.context,
      template: body.template,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      sent: false,
      provider: 'meta-cloud-api',
      reason: `http_${response.status}`,
      response: payload,
    } as const;
  }

  return {
    sent: true,
    provider: 'meta-cloud-api',
    reason: null,
    response: payload,
  } as const;
};

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.notificaciones)) {
    return fail('No tienes permisos para ver cola WhatsApp.', 403, 'forbidden');
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('notificaciones_whatsapp_queue'))
    .select('*')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return fail(`No se pudo cargar cola WhatsApp: ${error.message}`, 500);
  }

  return ok({
    data: data ?? [],
  });
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.notificaciones)) {
    return fail('No tienes permisos para enviar notificaciones de WhatsApp.', 403, 'forbidden');
  }

  let body: WhatsAppRequestBody;
  try {
    body = await parseJsonBody<WhatsAppRequestBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.to?.trim() || !body.message?.trim()) {
    return fail('to y message son obligatorios.', 400);
  }

  const scheduleAt = body.scheduleAt ? new Date(body.scheduleAt) : null;
  if (scheduleAt && Number.isNaN(scheduleAt.getTime())) {
    return fail('scheduleAt inválido.', 400);
  }

  const queueInsert = await authCtx.client.database
    .from(gymTable('notificaciones_whatsapp_queue'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        to_phone: body.to.trim(),
        template: body.template ?? null,
        message: body.message.trim(),
        context: body.context ?? {},
        estado: 'pendiente',
        intentos: 0,
        max_intentos: 3,
        next_retry_at: scheduleAt ? scheduleAt.toISOString() : new Date().toISOString(),
        created_by: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (queueInsert.error || !queueInsert.data) {
    return fail(`No se pudo encolar notificación: ${queueInsert.error?.message ?? 'unknown error'}`, 500);
  }

  const shouldSendNow = !scheduleAt || scheduleAt.getTime() <= Date.now();
  if (!shouldSendNow) {
    return ok({
      queued: true,
      notification: queueInsert.data,
      sent: false,
      reason: 'scheduled',
    });
  }

  const send = await sendToMeta(body);
  const currentAttempts = Number(queueInsert.data.intentos ?? 0) + 1;
  const maxAttempts = Number(queueInsert.data.max_intentos ?? 3);
  const failed = !send.sent;
  const nextRetryMinutes = Math.min(currentAttempts * 5, 60);
  const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000).toISOString();

  const queueUpdate = await authCtx.client.database
    .from(gymTable('notificaciones_whatsapp_queue'))
    .update({
      estado: send.sent ? 'enviado' : currentAttempts >= maxAttempts ? 'fallido' : 'pendiente',
      intentos: currentAttempts,
      ultimo_error: failed ? String(send.reason ?? 'send_failed') : null,
      provider_ref: send.sent ? JSON.stringify(send.response ?? {}) : null,
      next_retry_at: send.sent ? new Date().toISOString() : nextRetryAt,
    })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', queueInsert.data.id)
    .select('*')
    .single();

  if (queueUpdate.error || !queueUpdate.data) {
    return fail(
      `Notificación encolada pero falló actualización de estado: ${queueUpdate.error?.message ?? 'unknown error'}`,
      500
    );
  }

  return ok({
    queued: true,
    sent: send.sent,
    provider: send.provider,
    reason: send.reason,
    response: send.response,
    notification: queueUpdate.data,
  });
}

export async function PUT() {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.notificaciones)) {
    return fail('No tienes permisos para procesar cola WhatsApp.', 403, 'forbidden');
  }

  const nowIso = new Date().toISOString();
  const pending = await authCtx.client.database
    .from(gymTable('notificaciones_whatsapp_queue'))
    .select('*')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('estado', 'pendiente')
    .lte('next_retry_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(20);

  if (pending.error) {
    return fail(`No se pudo leer cola WhatsApp: ${pending.error.message}`, 500);
  }

  const processed: Array<{
    id: string;
    sent: boolean;
    estado: string;
    reason: string | null;
  }> = [];

  for (const item of pending.data ?? []) {
    const send = await sendToMeta({
      to: item.to_phone,
      template: item.template ?? undefined,
      message: item.message,
      context: item.context ?? undefined,
    });

    const currentAttempts = Number(item.intentos ?? 0) + 1;
    const maxAttempts = Number(item.max_intentos ?? 3);
    const nextRetryMinutes = Math.min(currentAttempts * 5, 60);

    const status = send.sent ? 'enviado' : currentAttempts >= maxAttempts ? 'fallido' : 'pendiente';
    const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000).toISOString();

    const update = await authCtx.client.database
      .from(gymTable('notificaciones_whatsapp_queue'))
      .update({
        estado: status,
        intentos: currentAttempts,
        ultimo_error: send.sent ? null : String(send.reason ?? 'send_failed'),
        provider_ref: send.sent ? JSON.stringify(send.response ?? {}) : item.provider_ref,
        next_retry_at: send.sent ? new Date().toISOString() : nextRetryAt,
      })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', item.id);

    if (update.error) {
      processed.push({
        id: item.id,
        sent: false,
        estado: 'error_update',
        reason: update.error.message,
      });
      continue;
    }

    processed.push({
      id: item.id,
      sent: send.sent,
      estado: status,
      reason: send.reason,
    });
  }

  return ok({
    processed,
    count: processed.length,
  });
}
