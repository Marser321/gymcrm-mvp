import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import { ONBOARDING_VERSION } from '@/lib/gymcrm/ui-settings';

type OnboardingPatchBody = {
  completed?: boolean;
  version?: number;
  dismissed?: boolean;
};

type OnboardingRow = {
  id: string;
  gimnasio_id: string;
  user_id: string;
  rol: string;
  version: number;
  completed: boolean;
  completed_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

const missingTable = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('gymcrm_ui_onboarding_estado') && normalized.includes('does not exist');
};

const toPublicState = (row: OnboardingRow | null, requestedVersion: number) => {
  const version = row?.version ?? requestedVersion;
  const versionMatches = version >= requestedVersion;

  return {
    completed: versionMatches ? Boolean(row?.completed) : false,
    completedAt: versionMatches ? row?.completed_at ?? null : null,
    dismissedAt: versionMatches ? row?.dismissed_at ?? null : null,
    version: requestedVersion,
  };
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const requestedVersionRaw = Number(url.searchParams.get('version') ?? ONBOARDING_VERSION);
  const requestedVersion =
    Number.isFinite(requestedVersionRaw) && requestedVersionRaw > 0
      ? Math.floor(requestedVersionRaw)
      : ONBOARDING_VERSION;

  const current = await authCtx.client.database
    .from(gymTable('ui_onboarding_estado'))
    .select('*')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('user_id', authCtx.authUserId)
    .eq('rol', authCtx.context.role)
    .maybeSingle();

  if (current.error) {
    if (missingTable(current.error.message)) {
      return ok({
        onboarding: toPublicState(null, requestedVersion),
        persisted: false,
        fallbackReason: 'table_missing',
      });
    }
    return fail(`No se pudo cargar onboarding UI: ${current.error.message}`, 500);
  }

  return ok({
    onboarding: toPublicState((current.data as OnboardingRow | null) ?? null, requestedVersion),
    persisted: Boolean(current.data),
  });
}

export async function PATCH(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  let body: OnboardingPatchBody;
  try {
    body = await parseJsonBody<OnboardingPatchBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const requestedVersionRaw = Number(body.version ?? ONBOARDING_VERSION);
  const requestedVersion =
    Number.isFinite(requestedVersionRaw) && requestedVersionRaw > 0
      ? Math.floor(requestedVersionRaw)
      : ONBOARDING_VERSION;

  if (body.completed === undefined && body.dismissed === undefined && body.version === undefined) {
    return fail('No hay campos para actualizar onboarding.', 400);
  }

  const existing = await authCtx.client.database
    .from(gymTable('ui_onboarding_estado'))
    .select('id')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('user_id', authCtx.authUserId)
    .eq('rol', authCtx.context.role)
    .maybeSingle();

  if (existing.error) {
    if (missingTable(existing.error.message)) {
      return ok({
        onboarding: {
          completed: Boolean(body.completed),
          completedAt: body.completed ? new Date().toISOString() : null,
          dismissedAt: body.dismissed ? new Date().toISOString() : null,
          version: requestedVersion,
        },
        persisted: false,
        fallbackReason: 'table_missing',
      });
    }
    return fail(`No se pudo consultar onboarding existente: ${existing.error.message}`, 500);
  }

  const payload: Record<string, unknown> = {
    version: requestedVersion,
  };

  if (body.completed !== undefined) {
    payload.completed = Boolean(body.completed);
    payload.completed_at = body.completed ? new Date().toISOString() : null;
  }

  if (body.dismissed !== undefined) {
    payload.dismissed_at = body.dismissed ? new Date().toISOString() : null;
  }

  if (existing.data?.id) {
    const updated = await authCtx.client.database
      .from(gymTable('ui_onboarding_estado'))
      .update(payload)
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', existing.data.id)
      .select('*')
      .single();

    if (updated.error || !updated.data) {
      return fail(`No se pudo actualizar onboarding UI: ${updated.error?.message ?? 'unknown error'}`, 500);
    }

    return ok({
      onboarding: toPublicState(updated.data as OnboardingRow, requestedVersion),
      persisted: true,
    });
  }

  const inserted = await authCtx.client.database
    .from(gymTable('ui_onboarding_estado'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: authCtx.authUserId,
        rol: authCtx.context.role,
        version: requestedVersion,
        completed: Boolean(body.completed),
        completed_at: body.completed ? new Date().toISOString() : null,
        dismissed_at: body.dismissed ? new Date().toISOString() : null,
      },
    ])
    .select('*')
    .single();

  if (inserted.error || !inserted.data) {
    return fail(`No se pudo guardar onboarding UI: ${inserted.error?.message ?? 'unknown error'}`, 500);
  }

  return ok({
    onboarding: toPublicState(inserted.data as OnboardingRow, requestedVersion),
    persisted: true,
  });
}
