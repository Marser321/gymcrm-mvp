export type UIActionState = 'idle' | 'loading' | 'success' | 'error';

export type UIExperienceSettings = {
  hapticsEnabled: boolean;
  reducedMotion: boolean;
};

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
    hapticsEnabled: false,
    reducedMotion: getSystemReducedMotion(),
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
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<UIExperienceSettings>;

    return {
      hapticsEnabled: Boolean(parsed.hapticsEnabled),
      reducedMotion: defaults.reducedMotion,
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
    reducedMotion: getSystemReducedMotion(),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hapticsEnabled: next.hapticsEnabled,
      })
    );
  }

  return next;
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

export const triggerHaptic = (event: HapticEvent, settings: UIExperienceSettings): boolean => {
  if (!canUseHaptics(settings)) return false;

  const pattern = hapticPatterns[event];

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
};
