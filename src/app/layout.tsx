import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import { InsforgeProvider } from './providers';
import './globals.css';

import { LenisProvider } from '@/components/lenis-provider';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { ExperienceControls } from '@/components/ui/ExperienceControls';
import { PWARegister } from '@/components/gymcrm/PWARegister';
import { OpenRoleSelector } from '@/components/gymcrm/OpenRoleSelector';
import { MainNavigation } from '@/components/gymcrm/MainNavigation';
import { getGymcrmDataMode, getGymcrmNavMode } from '@/lib/gymcrm/open-session';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'GymCRM — Gestión Inteligente para Gimnasios',
  description: 'CRM multi-tenant para gestión de gimnasios: miembros, suscripciones, clases, pagos y check-ins.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GymCRM',
  },
};

export const viewport: Viewport = {
  themeColor: '#111827',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dataMode = getGymcrmDataMode();
  const navMode = getGymcrmNavMode();

  return (
    <html lang="es">
      <body className={`antialiased ${outfit.variable} font-sans relative`}>
        <div className="fixed inset-0 z-[-1] bg-background">
          <div className="noise-bg" />
        </div>
        <InsforgeProvider>
          <PWARegister />
          <LenisProvider>
            <header className="flex items-center justify-between px-3 py-3 md:px-6 md:py-4 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-50">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20 text-primary-foreground">
                    💪
                  </div>
                  <span className="hidden sm:inline">GymCRM</span>
                </span>
              </div>
              <nav className="relative flex items-center gap-2">
                <MainNavigation navMode={navMode} />
                <ExperienceControls />
                <OpenRoleSelector mode={dataMode} />
                <ThemeSwitcher />
              </nav>
            </header>
            <main>{children}</main>
          </LenisProvider>
        </InsforgeProvider>
      </body>
    </html>
  );
}
