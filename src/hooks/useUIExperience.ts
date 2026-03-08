'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import type { AnalyticsConsentState, ThemeId } from '@/lib/gymcrm/ui-settings';
import {
  type HapticEvent,
  type UIExperienceSettings,
  applyThemeToDocument,
  getDefaultUIExperienceSettings,
  readUIExperienceSettings,
  triggerHaptic,
  writeUIExperienceSettings,
} from '@/lib/ui/experience';

type PreferencesResponse = {
  data: {
    settings: UIExperienceSettings;
    persisted: boolean;
  };
};

export const useUIExperience = () => {
  const [settings, setSettings] = useState<UIExperienceSettings>(getDefaultUIExperienceSettings());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const local = readUIExperienceSettings();
    applyThemeToDocument(local.themeId);
    setSettings(local);
    setReady(true);

    let cancelled = false;

    void (async () => {
      try {
        const remote = await apiGet<PreferencesResponse>('/api/gymcrm/ui/preferences');
        if (cancelled || !remote.data?.settings) return;
        const localLatest = readUIExperienceSettings();
        const remoteSettings = remote.data.settings;
        const hasMismatch =
          localLatest.themeId !== remoteSettings.themeId ||
          localLatest.hapticsEnabled !== remoteSettings.hapticsEnabled ||
          localLatest.reducedMotion !== remoteSettings.reducedMotion ||
          localLatest.analyticsConsent !== remoteSettings.analyticsConsent;

        if (hasMismatch) {
          // Keep local as source of truth when the user changed settings immediately before reload.
          void apiMutation<PreferencesResponse>('/api/gymcrm/ui/preferences', 'PATCH', {
            themeId: localLatest.themeId,
            hapticsEnabled: localLatest.hapticsEnabled,
            reducedMotion: localLatest.reducedMotion,
            analyticsConsent: localLatest.analyticsConsent,
          }).catch(() => {
            // ignore sync failure in open demo mode
          });
          return;
        }

        const synced = writeUIExperienceSettings(remoteSettings);
        applyThemeToDocument(synced.themeId);
        setSettings(synced);
      } catch {
        // Fallback to local-only experience when backend table is unavailable.
      }
    })();

    const syncFromStorage = () => {
      const next = readUIExperienceSettings();
      applyThemeToDocument(next.themeId);
      setSettings(next);
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'gymcrm-ui-experience') {
        syncFromStorage();
      }
    };

    const onCustomSync = () => {
      syncFromStorage();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('gymcrm:ui-settings-change', onCustomSync);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('gymcrm:ui-settings-change', onCustomSync);
    };
  }, []);

  const persistRemote = useCallback(async (patch: Partial<UIExperienceSettings>) => {
    try {
      const remote = await apiMutation<PreferencesResponse>('/api/gymcrm/ui/preferences', 'PATCH', patch);
      if (!remote.data?.settings) return;
      const synced = writeUIExperienceSettings(remote.data.settings);
      applyThemeToDocument(synced.themeId);
      setSettings(synced);
    } catch {
      // Silent fallback to local cache in open demo mode.
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<UIExperienceSettings>) => {
    const next = writeUIExperienceSettings(patch);
    applyThemeToDocument(next.themeId);
    setSettings(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gymcrm:ui-settings-change'));
    }
    void persistRemote(patch);
    return next;
  }, [persistRemote]);

  const setThemeId = useCallback(
    (themeId: ThemeId) => {
      return updateSettings({ themeId });
    },
    [updateSettings]
  );

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      return updateSettings({ hapticsEnabled: enabled });
    },
    [updateSettings]
  );

  const setAnalyticsConsent = useCallback(
    (analyticsConsent: AnalyticsConsentState) => {
      return updateSettings({ analyticsConsent });
    },
    [updateSettings]
  );

  const setReducedMotion = useCallback(
    (reducedMotion: boolean) => {
      return updateSettings({ reducedMotion });
    },
    [updateSettings]
  );

  const fireHaptic = useCallback(
    (event: HapticEvent) => {
      return triggerHaptic(event, settings);
    },
    [settings]
  );

  return {
    ready,
    settings,
    updateSettings,
    setThemeId,
    setHapticsEnabled,
    setReducedMotion,
    setAnalyticsConsent,
    fireHaptic,
  };
};
