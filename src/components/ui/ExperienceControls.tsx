'use client';

import { Smartphone, Waves } from 'lucide-react';
import { useUIExperience } from '@/hooks/useUIExperience';

export function ExperienceControls() {
  const { settings, setHapticsEnabled, setReducedMotion, fireHaptic } = useUIExperience();

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
      <Waves className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
      <button
        type="button"
        data-testid="toggle-reduced-motion"
        onClick={() => setReducedMotion(!settings.reducedMotion)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
          settings.reducedMotion ? 'bg-amber-500/20 text-amber-200' : 'bg-white/5 text-gray-300 hover:bg-white/10'
        }`}
        aria-pressed={settings.reducedMotion}
        title="Reducir animaciones"
      >
        {settings.reducedMotion ? 'Motion Reducida' : 'Motion Full'}
      </button>
      <button
        type="button"
        data-testid="toggle-haptics"
        onClick={() => setHapticsEnabled(!settings.hapticsEnabled)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
          settings.hapticsEnabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-gray-300 hover:bg-white/10'
        }`}
        aria-pressed={settings.hapticsEnabled}
        title="Hápticos móviles"
      >
        <Smartphone className="w-3 h-3" />
        {settings.hapticsEnabled ? 'Haptics ON' : 'Haptics OFF'}
      </button>
      {settings.hapticsEnabled ? (
        <button
          type="button"
          data-testid="preview-haptics"
          onClick={() => fireHaptic('success')}
          className="inline-flex items-center rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          title="Probar hápticos"
        >
          Probar
        </button>
      ) : null}
    </div>
  );
}
