import {
  type AnalyticsConsentState,
  type ThemeId,
  type UIExperienceSettings,
  isAnalyticsConsent,
  isThemeId,
} from '@/lib/gymcrm/ui-settings';
export type { UIExperienceSettings } from '@/lib/gymcrm/ui-settings';

export type UIActionState = 'idle' | 'loading' | 'success' | 'error';

const STORAGE_KEY = 'gymcrm-ui-experience';

export const getSystemReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const isMobileLikeDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 1024px)').matches;
};

export const getDefaultUIExperienceSettings = (): UIExperienceSettings => {
  return {
    themeId: 'default',
    hapticsEnabled: false,
    reducedMotion: getSystemReducedMotion(),
    analyticsConsent: 'pending',
  };
};

export const readUIExperienceSettings = (): UIExperienceSettings => {
  const defaults = getDefaultUIExperienceSettings();

  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacyTheme = window.localStorage.getItem('gym-crm-theme');
      if (isThemeId(legacyTheme)) {
        return {
          ...defaults,
          themeId: legacyTheme,
        };
      }
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<UIExperienceSettings>;
    const themeId = isThemeId(parsed.themeId) ? parsed.themeId : defaults.themeId;
    const analyticsConsent = isAnalyticsConsent(parsed.analyticsConsent)
      ? parsed.analyticsConsent
      : defaults.analyticsConsent;
    const reducedMotion = typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaults.reducedMotion;

    return {
      themeId,
      hapticsEnabled: Boolean(parsed.hapticsEnabled),
      reducedMotion,
      analyticsConsent,
    };
  } catch {
    return defaults;
  }
};

export const writeUIExperienceSettings = (patch: Partial<UIExperienceSettings>): UIExperienceSettings => {
  const current = readUIExperienceSettings();
  const next: UIExperienceSettings = {
    ...current,
    ...patch,
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        themeId: next.themeId,
        hapticsEnabled: next.hapticsEnabled,
        reducedMotion: next.reducedMotion,
        analyticsConsent: next.analyticsConsent,
      })
    );
    window.localStorage.removeItem('gym-crm-theme');
  }

  return next;
};

export const applyThemeToDocument = (themeId: ThemeId): void => {
  if (typeof document === 'undefined') return;
  if (themeId === 'default') {
    document.documentElement.removeAttribute('data-theme');
    return;
  }

  document.documentElement.setAttribute('data-theme', themeId);
};

export const canUseHaptics = (settings: UIExperienceSettings): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!settings.hapticsEnabled) return false;
  if (settings.reducedMotion) return false;
  if (!isMobileLikeDevice()) return false;

  return typeof navigator.vibrate === 'function';
};

export const hapticPatterns = {
  success: [18],
  warning: [18, 40, 18],
  error: [40, 30, 22],
} as const;

export type HapticEvent = keyof typeof hapticPatterns;

export const isAnalyticsEnabled = (settings: UIExperienceSettings): boolean => {
  return settings.analyticsConsent === 'granted';
};

export const normalizeAnalyticsConsent = (value: unknown): AnalyticsConsentState => {
  return isAnalyticsConsent(value) ? value : 'pending';
};

export const triggerHaptic = (event: HapticEvent, settings: UIExperienceSettings): boolean => {
  if (!canUseHaptics(settings)) return false;

  const pattern = hapticPatterns[event];

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
};
