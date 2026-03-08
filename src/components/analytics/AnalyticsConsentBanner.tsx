'use client';

import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useUIExperience } from '@/hooks/useUIExperience';

const analyticsFeatureEnabled = process.env.NEXT_PUBLIC_GYMCRM_ANALYTICS_ENABLED !== 'false';

export function AnalyticsConsentBanner() {
  const { settings, setAnalyticsConsent } = useUIExperience();
  const [isAutomation, setIsAutomation] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const automated = Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
    setIsAutomation(automated);
    if (automated && settings.analyticsConsent === 'pending') {
      setAnalyticsConsent('denied');
    }
  }, [setAnalyticsConsent, settings.analyticsConsent]);

  if (!analyticsFeatureEnabled) return null;
  if (settings.analyticsConsent !== 'pending') return null;
  if (isAutomation) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[75] md:left-auto md:max-w-md">
      <div className="rounded-2xl border border-white/10 bg-[#0a1120]/95 backdrop-blur-xl p-4 shadow-2xl">
        <p className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 text-cyan-200 text-xs px-3 py-1">
          <BarChart3 className="h-3.5 w-3.5" />
          Analítica UX
        </p>
        <p className="mt-3 text-sm text-gray-200">
          ¿Nos autorizas a medir navegación y uso para mejorar la demo (heatmaps/session replay)?
        </p>
        <p className="mt-1 text-xs text-gray-400">Puedes cambiar esto luego desde la misma sesión demo.</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="analytics-consent-deny"
            onClick={() => setAnalyticsConsent('denied')}
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/10"
          >
            Rechazar
          </button>
          <button
            type="button"
            data-testid="analytics-consent-allow"
            onClick={() => setAnalyticsConsent('granted')}
            className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-400"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
