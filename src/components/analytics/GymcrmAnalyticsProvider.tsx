'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import posthog from 'posthog-js';
import { usePathname } from 'next/navigation';
import { useOpenSession } from '@/hooks/useOpenSession';
import { useUIExperience } from '@/hooks/useUIExperience';

type AnalyticsContextValue = {
  track: (event: string, properties?: Record<string, unknown>) => void;
  enabled: boolean;
};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  track: () => {},
  enabled: false,
});

const analyticsFeatureEnabled = process.env.NEXT_PUBLIC_GYMCRM_ANALYTICS_ENABLED !== 'false';
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

export function GymcrmAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useOpenSession();
  const { settings } = useUIExperience();
  const initializedRef = useRef(false);

  const shouldTrack = analyticsFeatureEnabled && Boolean(posthogKey) && settings.analyticsConsent === 'granted';

  useEffect(() => {
    if (!analyticsFeatureEnabled || !posthogKey) return;

    if (!initializedRef.current) {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
      });
      initializedRef.current = true;
    }

    if (settings.analyticsConsent === 'granted') {
      posthog.opt_in_capturing();
      return;
    }

    if (settings.analyticsConsent === 'denied') {
      posthog.opt_out_capturing();
      return;
    }

    posthog.opt_out_capturing();
  }, [settings.analyticsConsent]);

  useEffect(() => {
    if (!shouldTrack) return;

    posthog.capture('portal_navigation', {
      path: pathname,
      role,
    });
  }, [pathname, role, shouldTrack]);

  const track = useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      if (!shouldTrack) return;
      posthog.capture(event, {
        role,
        path: pathname,
        ...properties,
      });
    },
    [pathname, role, shouldTrack]
  );

  const value = useMemo<AnalyticsContextValue>(
    () => ({
      track,
      enabled: shouldTrack,
    }),
    [shouldTrack, track]
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export const useGymcrmAnalytics = () => useContext(AnalyticsContext);
