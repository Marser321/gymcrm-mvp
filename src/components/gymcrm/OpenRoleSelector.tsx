'use client';

import { Shield } from 'lucide-react';
import { OPEN_ROLES, type DataMode, type OpenRole } from '@/lib/gymcrm/open-session';
import { useOpenSession } from '@/hooks/useOpenSession';

type OpenRoleSelectorProps = {
  mode: DataMode;
};

const roleLabel: Record<OpenRole, string> = {
  admin: 'Admin',
  recepcion: 'Recepción',
  entrenador: 'Entrenador',
  cliente: 'Cliente',
  nutricionista: 'Nutricionista',
};

export function OpenRoleSelector({ mode }: OpenRoleSelectorProps) {
  const { role, ready, setRole } = useOpenSession();

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
      <span
        data-testid="open-mode-badge"
        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold tracking-wide ${
          mode === 'demo' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'
        }`}
      >
        {mode.toUpperCase()}
      </span>
      <label className="inline-flex items-center gap-1 text-[11px] text-gray-300">
        <Shield className="h-3 w-3 text-sky-300" />
        Rol
      </label>
      <select
        value={role}
        disabled={!ready}
        data-testid="open-role-selector"
        onChange={(event) => {
          const nextRole = event.target.value as OpenRole;
          const changed = setRole(nextRole);
          window.dispatchEvent(new CustomEvent('gymcrm:open-role-change', { detail: { role: changed } }));
          window.location.reload();
        }}
        className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-60"
      >
        {OPEN_ROLES.map((option) => (
          <option key={option} value={option}>
            {roleLabel[option]}
          </option>
        ))}
      </select>
    </div>
  );
}

