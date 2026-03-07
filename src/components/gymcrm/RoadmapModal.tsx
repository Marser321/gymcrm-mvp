'use client';

import { CalendarClock, CircleDashed, X } from 'lucide-react';
import type { ActionAvailability } from '@/lib/gymcrm/demo-ui';

type RoadmapModalProps = {
  action: ActionAvailability | null;
  open: boolean;
  onClose: () => void;
};

export function RoadmapModal({ action, open, onClose }: RoadmapModalProps) {
  if (!open || !action) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1020] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 text-amber-200 text-xs px-3 py-1">
              <CircleDashed className="w-3.5 h-3.5" />
              Roadmap
            </p>
            <h2 className="mt-3 text-xl text-white font-semibold">{action.roadmapTitle}</h2>
            <p className="mt-2 text-sm text-gray-300">{action.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-300 hover:text-white hover:bg-white/10"
            aria-label="Cerrar roadmap"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-gray-300">
            Estado: <span className="text-white font-medium">No implementado</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-gray-300 inline-flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-cyan-300" />
            ETA: <span className="text-white font-medium">{action.etaLabel}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-gray-300 md:col-span-2">
            Responsable: <span className="text-white font-medium">{action.owner}</span>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-4 py-2.5"
            data-testid="roadmap-close"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
