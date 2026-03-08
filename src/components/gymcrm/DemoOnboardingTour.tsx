'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Compass, Sparkles } from 'lucide-react';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import { ONBOARDING_VERSION, type OnboardingState } from '@/lib/gymcrm/ui-settings';

type OnboardingResponse = {
  data: {
    onboarding: OnboardingState & {
      dismissedAt?: string | null;
    };
    persisted: boolean;
  };
};

type TourStep = {
  title: string;
  description: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    title: '1. Dashboard operativo',
    description: 'Empieza en Dashboard para ver KPIs, alertas y estado del gimnasio en tiempo real.',
  },
  {
    title: '2. Gestión de clientes',
    description: 'Desde Admin crea clientes, asigna membresías y registra cobros manuales.',
  },
  {
    title: '3. Clases y asistencia',
    description: 'Programa horarios, controla cupos, check-in QR/manual y asistencia final asistió/ausente.',
  },
  {
    title: '4. Builder y comunidad',
    description: 'Publica servicios dinámicos, asigna puntos y gestiona canjes para fidelización.',
  },
  {
    title: '5. Nutrición',
    description: 'Registra consentimiento, activa plan y sigue adherencia con mediciones.',
  },
  {
    title: '6. Portal cliente',
    description: 'El cliente reserva, canjea y consulta su avance en una sola vista.',
  },
];

const onboardingEnabled = process.env.NEXT_PUBLIC_GYMCRM_ONBOARDING_ENABLED !== 'false';

export function DemoOnboardingTour() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isAutomation, setIsAutomation] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const step = useMemo(() => TOUR_STEPS[stepIndex], [stepIndex]);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const completeTour = useCallback(async () => {
    setOpen(false);
    setStepIndex(0);
    try {
      await apiMutation('/api/gymcrm/ui/onboarding', 'PATCH', {
        version: ONBOARDING_VERSION,
        completed: true,
      });
    } catch {
      // keep UX fluid in demo mode
    }
  }, []);

  const dismissTour = useCallback(async () => {
    setOpen(false);
    setStepIndex(0);
    try {
      await apiMutation('/api/gymcrm/ui/onboarding', 'PATCH', {
        version: ONBOARDING_VERSION,
        dismissed: true,
      });
    } catch {
      // keep UX fluid in demo mode
    }
  }, []);

  const relaunch = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const automated = Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
      const forceOnboardingInE2E = new URLSearchParams(window.location.search).get('onboarding_e2e') === '1';
      setIsAutomation(automated && !forceOnboardingInE2E);
      if (automated && !forceOnboardingInE2E) {
        setReady(true);
        return;
      }
    }

    if (!onboardingEnabled) {
      setReady(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const state = await apiGet<OnboardingResponse>(`/api/gymcrm/ui/onboarding?version=${ONBOARDING_VERSION}`);
        if (cancelled) return;
        const onboarding = state.data?.onboarding;
        setReady(true);
        if (!onboarding?.completed) {
          setOpen(true);
        }
      } catch {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || isAutomation) return null;

  const overlay = open ? (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-black/72 backdrop-blur-sm"
      data-testid="onboarding-overlay"
    >
      <div className="flex min-h-[100svh] items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))] sm:px-4 sm:py-6">
        <div
          className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0a1120] p-5 shadow-2xl sm:p-6 md:p-7"
          data-testid="onboarding-modal"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            Demo guiada (90s)
          </p>

          <h2 className="mt-4 text-xl font-semibold text-white sm:text-2xl">{step.title}</h2>
          <p className="mt-2 text-sm text-gray-300 sm:text-base">{step.description}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              disabled={isFirst}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40"
            >
              Anterior
            </button>

            <p className="text-center text-xs text-gray-400 sm:text-left">
              Paso {stepIndex + 1} de {TOUR_STEPS.length}
            </p>

            {isLast ? (
              <button
                type="button"
                onClick={completeTour}
                data-testid="onboarding-finish"
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400"
              >
                Finalizar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1))}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400"
              >
                Siguiente
              </button>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={dismissTour}
              data-testid="onboarding-dismiss"
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Cerrar por ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={relaunch}
        data-testid="onboarding-relaunch"
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10"
        title="Ver demo guiada"
      >
        <Compass className="h-3.5 w-3.5 text-cyan-300" />
        Ver demo
      </button>
      {isMounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
