'use client';

import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

const buildWhatsAppHref = () => {
  const raw = process.env.NEXT_PUBLIC_GYMCRM_WHATSAPP_PHONE ?? '';
  const normalized = raw.replace(/\D/g, '');
  const target = normalized || '59800000000';
  return `https://wa.me/${target}?text=Hola,%20me%20interesa%20GymCRM`;
};

export function WhatsappButton() {
  const href = buildWhatsAppHref();

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="cta-whatsapp-floating"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-green-500 text-white rounded-full shadow-lg shadow-green-500/30 hover:bg-green-400 hover:scale-110 transition-all origin-center"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1 }}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="w-7 h-7" />
      <span className="sr-only">Contactar por WhatsApp</span>
    </motion.a>
  );
}
