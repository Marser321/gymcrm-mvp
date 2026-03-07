import Link from 'next/link';
import { HeroSection } from '@/components/ui/hero-section';
import { BenefitsSection } from '@/components/ui/benefits-section';
import { NutritionSection } from '@/components/ui/nutrition-section';
import { WhatsappButton } from '@/components/ui/whatsapp-button';
import { HeroPanel, StickyActionBar } from '@/components/ui/premium';

const buildWhatsAppHref = () => {
  const raw = process.env.NEXT_PUBLIC_GYMCRM_WHATSAPP_PHONE ?? '';
  const normalized = raw.replace(/\D/g, '');
  const target = normalized || '59800000000';
  return `https://wa.me/${target}?text=Hola,%20quiero%20una%20demo%20de%20GymCRM`;
};

export default function Home() {
  const whatsappHref = buildWhatsAppHref();

  return (
    <div className="min-h-screen flex flex-col relative">
      <HeroSection />
      <BenefitsSection />
      <NutritionSection />

      <section className="relative w-full py-32 px-6 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none" />

        <HeroPanel className="text-center p-12 md:p-20 max-w-4xl mx-auto border-primary/20 bg-background/50 shadow-[0_0_50px_var(--theme-glow)]">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
            ¿Listo para llevar tu marca al <br className="hidden md:block" />
            <span className="text-primary text-glow">siguiente nivel?</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto font-light">
            Obtén una demostración personalizada y descubre cómo nuestra plataforma puede transformar tus ventas,
            retención y la experiencia de tus clientes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              data-testid="cta-vip-dashboard"
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              Agendar Demostración VIP
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="cta-vip-whatsapp"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-4 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </HeroPanel>
      </section>

      <footer className="border-t border-white/5 py-12 px-6 text-center text-muted-foreground text-sm backdrop-blur-md">
        <p>&copy; {new Date().getFullYear()} GymCRM Ultra-Luxury Edition. Diseñado para dominar.</p>
      </footer>

      <StickyActionBar className="hidden md:block">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-300">Activa tu demo premium y valida operación real en minutos.</p>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              data-testid="sticky-cta-dashboard"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ir al Dashboard
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="sticky-cta-whatsapp"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Demo por WhatsApp
            </a>
          </div>
        </div>
      </StickyActionBar>

      <WhatsappButton />
    </div>
  );
}
