'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type HeroPanelProps = HTMLMotionProps<'div'> & {
  children: ReactNode;
};

export function HeroPanel({ className, children, ...props }: HeroPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.10] via-white/[0.04] to-transparent p-8 shadow-[0_24px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl',
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_0%_0%,rgba(255,255,255,0.1),transparent_45%)]" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

type MetricCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  className?: string;
};

export function MetricCard({ label, value, hint, icon, className }: MetricCardProps) {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_6px_28px_rgba(0,0,0,0.24)]', className)}>
      <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-3xl font-bold text-white leading-none">{value}</p>
        {icon ? <span className="text-primary">{icon}</span> : null}
      </div>
      {hint ? <p className="mt-3 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

type ActionCardProps = {
  title: string;
  description: string;
  action: ReactNode;
  className?: string;
};

export function ActionCard({ title, description, action, className }: ActionCardProps) {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-black/30 p-4', className)}>
      <h3 className="text-white font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

type StatusPillProps = {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
};

const toneClasses: Record<NonNullable<StatusPillProps['tone']>, string> = {
  neutral: 'bg-white/10 text-gray-200 border-white/15',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  danger: 'bg-red-500/15 text-red-300 border-red-400/30',
  info: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
};

export function StatusPill({ children, tone = 'neutral', className }: StatusPillProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', toneClasses[tone], className)}>
      {children}
    </span>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center', className)}>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-400 max-w-xl mx-auto">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StickyActionBar({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 z-40 w-[min(95vw,860px)] -translate-x-1/2 rounded-2xl border border-white/12 bg-black/65 px-4 py-3 shadow-[0_18px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
