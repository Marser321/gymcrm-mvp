'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type HapticEvent,
  type UIExperienceSettings,
  getDefaultUIExperienceSettings,
  readUIExperienceSettings,
  triggerHaptic,
  writeUIExperienceSettings,
} from '@/lib/ui/experience';

export const useUIExperience = () => {
  const [settings, setSettings] = useState<UIExperienceSettings>(getDefaultUIExperienceSettings());

  useEffect(() => {
    setSettings(readUIExperienceSettings());
  }, []);

  const updateSettings = useCallback((patch: Partial<UIExperienceSettings>) => {
    const next = writeUIExperienceSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      return updateSettings({ hapticsEnabled: enabled });
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
    settings,
    updateSettings,
    setHapticsEnabled,
    fireHaptic,
  };
};
