import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import {
  ANALYTICS_CONSENT_STATES,
  UI_THEME_IDS,
  isAnalyticsConsent,
  isThemeId,
  type AnalyticsConsentState,
  type ThemeId,
} from '@/lib/gymcrm/ui-settings';

type PreferencesPatchBody = {
  themeId?: ThemeId;
  hapticsEnabled?: boolean;
  reducedMotion?: boolean;
  analyticsConsent?: AnalyticsConsentState;
};

type PreferenceRow = {
  id: string;
  gimnasio_id: string;
  user_id: string;
  rol: string;
  theme_id: ThemeId;
  haptics_enabled: boolean;
  reduced_motion: boolean;
  analytics_consent: AnalyticsConsentState;
  created_at: string;
  updated_at: string;
};

const DEFAULT_PREFERENCES = {
  theme_id: 'default' as ThemeId,
  haptics_enabled: false,
  reduced_motion: false,
  analytics_consent: 'pending' as AnalyticsConsentState,
};

const missingTable = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('gymcrm_ui_preferencias') && normalized.includes('does not exist');
};

const toPublicSettings = (row: PreferenceRow | typeof DEFAULT_PREFERENCES) => {
  const themeId = isThemeId((row as Partial<PreferenceRow>).theme_id) ? (row as PreferenceRow).theme_id : 'default';
  const analyticsConsent = isAnalyticsConsent((row as Partial<PreferenceRow>).analytics_consent)
    ? (row as PreferenceRow).analytics_consent
    : 'pending';

  return {
    themeId,
    hapticsEnabled: Boolean((row as Partial<PreferenceRow>).haptics_enabled),
    reducedMotion: Boolean((row as Partial<PreferenceRow>).reduced_motion),
    analyticsConsent,
  };
};

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const current = await authCtx.client.database
    .from(gymTable('ui_preferencias'))
    .select('*')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('user_id', authCtx.authUserId)
    .eq('rol', authCtx.context.role)
    .maybeSingle();

  if (current.error) {
    if (missingTable(current.error.message)) {
      return ok({
        settings: toPublicSettings(DEFAULT_PREFERENCES),
        persisted: false,
        fallbackReason: 'table_missing',
      });
    }
    return fail(`No se pudieron cargar preferencias UI: ${current.error.message}`, 500);
  }

  return ok({
    settings: toPublicSettings((current.data as PreferenceRow | null) ?? DEFAULT_PREFERENCES),
    persisted: Boolean(current.data),
  });
}

export async function PATCH(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  let body: PreferencesPatchBody;
  try {
    body = await parseJsonBody<PreferencesPatchBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const patch: Record<string, unknown> = {};

  if (body.themeId !== undefined) {
    if (!isThemeId(body.themeId)) {
      return fail(`themeId inválido. Valores permitidos: ${UI_THEME_IDS.join(', ')}`, 400);
    }
    patch.theme_id = body.themeId;
  }

  if (body.hapticsEnabled !== undefined) {
    patch.haptics_enabled = Boolean(body.hapticsEnabled);
  }

  if (body.reducedMotion !== undefined) {
    patch.reduced_motion = Boolean(body.reducedMotion);
  }

  if (body.analyticsConsent !== undefined) {
    if (!isAnalyticsConsent(body.analyticsConsent)) {
      return fail(
        `analyticsConsent inválido. Valores permitidos: ${ANALYTICS_CONSENT_STATES.join(', ')}`,
        400
      );
    }
    patch.analytics_consent = body.analyticsConsent;
  }

  if (Object.keys(patch).length === 0) {
    return fail('No hay campos válidos para actualizar preferencias.', 400);
  }

  const existing = await authCtx.client.database
    .from(gymTable('ui_preferencias'))
    .select('id')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('user_id', authCtx.authUserId)
    .eq('rol', authCtx.context.role)
    .maybeSingle();

  if (existing.error) {
    if (missingTable(existing.error.message)) {
      return ok({
        settings: toPublicSettings({
          ...DEFAULT_PREFERENCES,
          ...(patch as Partial<typeof DEFAULT_PREFERENCES>),
        }),
        persisted: false,
        fallbackReason: 'table_missing',
      });
    }
    return fail(`No se pudo consultar preferencias existentes: ${existing.error.message}`, 500);
  }

  if (existing.data?.id) {
    const updated = await authCtx.client.database
      .from(gymTable('ui_preferencias'))
      .update(patch)
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', existing.data.id)
      .select('*')
      .single();

    if (updated.error || !updated.data) {
      return fail(`No se pudieron actualizar preferencias UI: ${updated.error?.message ?? 'unknown error'}`, 500);
    }

    return ok({
      settings: toPublicSettings(updated.data as PreferenceRow),
      persisted: true,
    });
  }

  const inserted = await authCtx.client.database
    .from(gymTable('ui_preferencias'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: authCtx.authUserId,
        rol: authCtx.context.role,
        ...DEFAULT_PREFERENCES,
        ...patch,
      },
    ])
    .select('*')
    .single();

  if (inserted.error || !inserted.data) {
    return fail(`No se pudieron guardar preferencias UI: ${inserted.error?.message ?? 'unknown error'}`, 500);
  }

  return ok({
    settings: toPublicSettings(inserted.data as PreferenceRow),
    persisted: true,
  });
}
