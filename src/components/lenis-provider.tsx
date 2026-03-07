'use client';

import { ReactLenis } from 'lenis/react';
import React, { useEffect, useState } from 'react';

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();

    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return (
    <ReactLenis
      root
      options={{
        lerp: reducedMotion ? 1 : 0.1,
        duration: reducedMotion ? 0 : 1.2,
        smoothWheel: !reducedMotion,
      }}
    >
      {children}
    </ReactLenis>
  );
}
