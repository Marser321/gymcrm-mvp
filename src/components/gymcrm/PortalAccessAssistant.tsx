'use client';

import Link from 'next/link';
import { ShieldAlert, UserCog } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { useOpenSession } from '@/hooks/useOpenSession';
import type { PortalAccessIntent } from '@/lib/gymcrm/demo-ui';
import type { OpenRole } from '@/lib/gymcrm/open-session';

type PortalAccessAssistantProps = {
  intent: PortalAccessIntent;
  currentRole?: string | null;
  title?: string;
  description?: string;
  error?: string | null;
};

const roleLabel: Record<OpenRole, string> = {
  admin: 'Admin',
  recepcion: 'Recepcion',
  entrenador: 'Entrenador',
  cliente: 'Cliente',
  nutricionista: 'Nutricionista',
};

export function PortalAccessAssistant({
  intent,
  currentRole,
  title = 'Portal restringido por rol',
  description = 'Para probar este portal en demo abierta, cambiá de rol y entrá directo con el botón principal.',
  error,
}: PortalAccessAssistantProps) {
  const { setRole } = useOpenSession();
  const targetLabel = roleLabel[intent.recommendedRole];
  const currentLabel = currentRole && currentRole in roleLabel ? roleLabel[currentRole as OpenRole] : 'sin rol';

  const switchRole = () => {
    const changed = setRole(intent.recommendedRole);
    window.dispatchEvent(new CustomEvent('gymcrm:open-role-change', { detail: { role: changed } }));
    window.setTimeout(() => {
      window.location.assign(intent.route);
    }, 20);
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <GlassPanel className="space-y-5" data-testid="portal-access-card">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-300 mt-0.5" />
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
              <p className="text-gray-300">{description}</p>
            </div>
          </div>

          <p className="text-sm text-gray-300">
            Rol actual: <span className="text-white font-semibold">{currentLabel}</span>. Rol sugerido para este portal:{' '}
            <span className="text-cyan-300 font-semibold">{targetLabel}</span>.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={switchRole}
              data-testid="portal-access-switch-role"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-4 py-2.5"
            >
              <UserCog className="w-4 h-4" />
              {intent.ctaLabel}
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5"
            >
              Volver al dashboard
            </Link>
          </div>

          {error ? <p className="text-red-300 text-sm">{error}</p> : null}
        </GlassPanel>
      </div>
    </div>
  );
}
