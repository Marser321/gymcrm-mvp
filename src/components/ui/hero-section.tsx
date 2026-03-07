'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { CrystalCard } from './crystal-card';

export function HeroSection() {
  return (
    <section className="relative min-h-[calc(100svh-72px)] md:min-h-[calc(100svh-80px)] w-full flex items-start justify-center pt-6 md:pt-8 pb-8 md:pb-10 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(34,197,94,0.18),transparent_44%)]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-8 items-start lg:items-center">
        <div className="flex flex-col items-start text-left">
          <div className="inline-flex items-center justify-center px-5 py-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md mb-6">
            <span className="text-sm font-semibold text-primary">La Nueva Era del Fitness</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-foreground mb-5 leading-[1.05]">
            Transforma tu
            <br />
            <span className="text-glow text-primary">Gimnasio</span>
            <br />
            en un Imperio.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mr-auto max-w-xl mb-7 leading-relaxed font-light">
            Ofrece a tus clientes una experiencia élite con tu propia App ultra-premium. Integraciones perfectas,
            seguimiento visual y máxima retención.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
            <Link
              href="/dashboard"
              data-testid="cta-start-free"
              className="w-full sm:w-auto inline-flex items-center justify-center text-lg h-16 px-10 rounded-full bg-primary text-primary-foreground shadow-[0_0_30px_var(--theme-glow)] hover:bg-primary/90 transition-colors"
            >
              Empieza Gratis
            </Link>
            <button
              type="button"
              data-testid="cta-view-features"
              onClick={() => {
                const target = document.getElementById('benefits');
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="px-8 py-4 h-16 rounded-full text-foreground font-semibold text-lg hover:bg-white/5 transition-all glass"
            >
              Ver Funciones
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0 }}
          className="relative w-full h-[420px] sm:h-[500px] lg:h-[580px] flex items-center justify-center mt-2 lg:mt-0"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] lg:w-[450px] lg:h-[450px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

          <CrystalCard glow className="relative z-20 w-72 h-96 sm:w-80 sm:h-[400px] flex flex-col justify-between border-white/10 shadow-2xl p-8">
            <div>
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-medium text-foreground">Mi Progreso</h3>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-primary text-sm">📈</span>
                </div>
              </div>
              <div className="text-6xl font-bold text-primary text-glow tracking-tighter">
                47.5<span className="text-3xl text-primary/70">kg</span>
              </div>
            </div>

            <div className="relative w-full h-32 mt-8">
              <svg className="absolute inset-0 w-full h-full stroke-primary drop-shadow-[0_0_8px_var(--theme-glow)]" viewBox="0 0 100 40" fill="none" preserveAspectRatio="none">
                <motion.path
                  d="M0 35 Q 15 35, 25 25 T 50 15 T 75 10 T 100 2"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2.5, ease: 'easeInOut', delay: 0.8 }}
                />
                <motion.circle cx="25" cy="25" r="2" fill="currentColor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="text-primary" />
                <motion.circle cx="50" cy="15" r="2" fill="currentColor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="text-primary" />
                <motion.circle cx="75" cy="10" r="2" fill="currentColor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0 }} className="text-primary" />
                <motion.circle cx="100" cy="2" r="3" fill="currentColor" className="text-white" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.5, type: 'spring' }} />
              </svg>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-4 px-2">
              <span>Lun</span>
              <span>Mié</span>
              <span>Vie</span>
              <span>Dom</span>
            </div>
          </CrystalCard>

          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [-15, 15, -15] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[5%] left-[0%] lg:left-[-5%] z-30"
          >
            <CrystalCard className="p-4 flex items-center gap-4 bg-[#151515] border-white/5 backdrop-blur-2xl shadow-xl">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 20v-6M6 20V10M18 20V4" /></svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Actividad Reciente</h4>
                <p className="text-xl font-bold text-foreground">7,890 <span className="text-sm font-normal text-muted-foreground">pasos</span></p>
              </div>
            </CrystalCard>
          </motion.div>

          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [10, -10, 10] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute bottom-[5%] right-[-5%] lg:right-[-10%] z-30"
          >
            <CrystalCard className="p-4 flex items-center gap-4 bg-[#151515] border-white/5 backdrop-blur-2xl shadow-xl">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-xl">🔥</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Desafío Diario</h4>
                <p className="text-xl font-bold text-foreground">1,120 <span className="text-sm font-normal text-muted-foreground">kcal</span></p>
              </div>
            </CrystalCard>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
