export const UI_THEME_IDS = ['default', 'graphite', 'ocean', 'sand'] as const;
export type ThemeId = (typeof UI_THEME_IDS)[number];

export const ANALYTICS_CONSENT_STATES = ['pending', 'granted', 'denied'] as const;
export type AnalyticsConsentState = (typeof ANALYTICS_CONSENT_STATES)[number];

export type UIExperienceSettings = {
  themeId: ThemeId;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  analyticsConsent: AnalyticsConsentState;
};

export type OnboardingState = {
  completed: boolean;
  completedAt: string | null;
  version: number;
};

export const ONBOARDING_VERSION = 1;

export const isThemeId = (value: unknown): value is ThemeId => {
  return typeof value === 'string' && UI_THEME_IDS.includes(value as ThemeId);
};

export const isAnalyticsConsent = (value: unknown): value is AnalyticsConsentState => {
  return typeof value === 'string' && ANALYTICS_CONSENT_STATES.includes(value as AnalyticsConsentState);
};
