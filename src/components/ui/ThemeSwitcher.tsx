'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useUIExperience } from '@/hooks/useUIExperience';
import { UI_THEME_IDS, type ThemeId } from '@/lib/gymcrm/ui-settings';

const themes: Array<{ id: ThemeId; name: string; color: string }> = [
  { id: 'default', name: 'Luxury Sport', color: 'bg-emerald-500' },
  { id: 'graphite', name: 'Graphite Steel', color: 'bg-slate-500' },
  { id: 'ocean', name: 'Ocean Carbon', color: 'bg-cyan-500' },
  { id: 'sand', name: 'Sand Titanium', color: 'bg-amber-500' },
];

export function ThemeSwitcher() {
  const { settings, setThemeId } = useUIExperience();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const currentTheme = useMemo(
    () => (UI_THEME_IDS.includes(settings.themeId) ? settings.themeId : 'default'),
    [settings.themeId]
  );

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        data-testid="theme-switcher"
        onClick={() => setIsOpen((value) => !value)}
        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        title="Cambiar tema visual"
        aria-expanded={isOpen}
      >
        <Palette className="w-5 h-5 text-gray-300" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-14 w-52 rounded-xl bg-[#101318] border border-white/10 shadow-2xl overflow-hidden animate-fade-in-up z-50">
          <div className="p-3 border-b border-white/5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Variantes Luxury</p>
          </div>
          <div className="p-2 space-y-1">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                data-testid={`theme-option-${theme.id}`}
                onClick={() => {
                  setThemeId(theme.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentTheme === theme.id ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${theme.color} shadow-[0_0_10px_currentColor]`} />
                  {theme.name}
                </span>
                {currentTheme === theme.id ? <Check className="w-4 h-4 text-emerald-400" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
