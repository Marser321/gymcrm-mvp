'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useOpenSession } from '@/hooks/useOpenSession';
import type { NavMode, OpenRole } from '@/lib/gymcrm/open-session';

type NavItem = {
  href: string;
  label: string;
  group: 'Operacion' | 'Admin' | 'Cliente';
  roles: OpenRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', group: 'Operacion', roles: ['admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista'] },
  { href: '/dashboard/classes', label: 'Clases', group: 'Operacion', roles: ['admin', 'recepcion', 'entrenador', 'cliente', 'nutricionista'] },
  { href: '/admin', label: 'Consola', group: 'Admin', roles: ['admin', 'recepcion', 'entrenador', 'nutricionista'] },
  { href: '/admin/classes', label: 'Admin Clases', group: 'Admin', roles: ['admin', 'recepcion', 'entrenador'] },
  { href: '/admin/builder', label: 'Builder', group: 'Admin', roles: ['admin', 'recepcion', 'entrenador'] },
  { href: '/admin/comunidad', label: 'Comunidad', group: 'Admin', roles: ['admin', 'recepcion', 'entrenador'] },
  { href: '/admin/nutricion', label: 'Nutricion', group: 'Admin', roles: ['admin', 'nutricionista'] },
  { href: '/cliente', label: 'Portal Cliente', group: 'Cliente', roles: ['cliente'] },
];

type MainNavigationProps = {
  navMode: NavMode;
};

export function MainNavigation({ navMode }: MainNavigationProps) {
  const { role } = useOpenSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = useMemo(() => {
    if (navMode === 'demo_all') return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => item.roles.includes(role));
  }, [navMode, role]);

  const groups = useMemo(() => {
    return {
      Operacion: visibleItems.filter((item) => item.group === 'Operacion'),
      Admin: visibleItems.filter((item) => item.group === 'Admin'),
      Cliente: visibleItems.filter((item) => item.group === 'Cliente'),
    };
  }, [visibleItems]);

  const contextPortal = pathname === '/' ? 'Landing' : pathname;

  return (
    <>
      <div className="hidden lg:flex items-center gap-5">
        {(['Operacion', 'Admin', 'Cliente'] as const).map((groupKey) => {
          const groupItems = groups[groupKey];
          if (groupItems.length === 0) return null;
          return (
            <div key={groupKey} className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-gray-500">{groupKey}</span>
              <div className="flex items-center gap-2">
                {groupItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`text-sm font-medium transition-colors ${
                        active ? 'text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex lg:hidden items-center gap-2">
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-gray-200 hover:text-white"
          data-testid="mobile-nav-toggle"
          aria-label="Abrir navegacion"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
        <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold tracking-wide bg-sky-500/20 text-sky-100">
          {navMode === 'demo_all' ? 'DEMO' : 'ROLE'}
        </span>
        <span className="text-[10px] text-gray-300">
          Rol <span className="text-white font-semibold">{role}</span>
        </span>
        <span className="text-[10px] text-gray-500">|</span>
        <span className="text-[10px] text-gray-300">
          Portal <span className="text-white font-semibold">{contextPortal}</span>
        </span>
      </div>

      {mobileOpen ? (
        <div className="absolute left-3 right-3 top-[62px] z-[60] rounded-2xl border border-white/10 bg-[#0a1120]/95 backdrop-blur-lg p-3 shadow-2xl lg:hidden">
          {(['Operacion', 'Admin', 'Cliente'] as const).map((groupKey) => {
            const groupItems = groups[groupKey];
            if (groupItems.length === 0) return null;
            return (
              <div key={groupKey} className="mb-3 last:mb-0">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{groupKey}</p>
                <div className="grid grid-cols-1 gap-1">
                  {groupItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          active ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
