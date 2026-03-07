'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Calendar, CheckCircle2, CreditCard, TrendingUp, TriangleAlert, Users, Zap } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { ActionCard, EmptyState, HeroPanel, MetricCard, StatusPill } from '@/components/ui/premium';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import { toUserErrorMessage } from '@/lib/gymcrm/error';

type DashboardResponse = {
  data: {
    kpis: {
      totalClientesActivos: number;
      membresiasActivas: number;
      pagosMes: number;
      retencionMensual: number;
      reservasConfirmadasHoy: number;
      adopcionServiciosDinamicos: number;
      tasaCanje: number;
      participacionRetos: number;
      adherenciaNutricional: number;
    };
    recientes: {
      clientes: Array<{
        id: string;
        nombres: string;
        apellidos: string;
        email: string | null;
        estado: string;
        created_at: string;
      }>;
      horarios: Array<{
        id: string;
        clase_base_id: string;
        inicio: string;
        fin: string;
        estado: string;
        cupo_total: number;
      }>;
    };
  };
};

type MeResponse = {
  data: {
    ready: boolean;
    role: {
      rol: string;
    } | null;
  };
};

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 animate-pulse">
          <div className="h-3 w-28 bg-white/10 rounded" />
          <div className="mt-4 h-8 w-20 bg-white/10 rounded" />
          <div className="mt-3 h-3 w-24 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse['data'] | null>(null);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: 'UYU',
        maximumFractionDigits: 0,
      }),
    []
  );

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const me = await apiGet<MeResponse>('/api/gymcrm/me');
      setReady(me.data.ready);

      if (!me.data.ready) {
        setDashboard(null);
        return;
      }

      const result = await apiGet<DashboardResponse>('/api/gymcrm/dashboard');
      setDashboard(result.data);
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar el dashboard.'));
      setDashboard(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleBootstrap = async () => {
    setIsBootstrapping(true);
    setError(null);

    try {
      await apiMutation('/api/gymcrm/bootstrap', 'POST', {
        nombreGym: 'Gym Piloto',
        nombreSede: 'Sede Central',
      });
      await loadDashboard();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo inicializar GymCRM.'));
    } finally {
      setIsBootstrapping(false);
    }
  };

  if (!ready && !isLoading) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden pb-20">
        <NoiseTexture />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20">
          <GlassPanel>
            <h1 className="text-3xl font-bold text-white mb-3">Inicialización requerida</h1>
            <p className="text-gray-300 mb-6">
              Tu cuenta aún no tiene un rol GymCRM asignado. Inicializa el gimnasio para crear sede, rol admin, planes y clases base.
            </p>
            <button
              data-testid="bootstrap-gymcrm"
              onClick={handleBootstrap}
              disabled={isBootstrapping}
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold disabled:opacity-60"
            >
              {isBootstrapping ? 'Inicializando...' : 'Inicializar GymCRM'}
            </button>
            {error ? <p className="mt-4 text-red-300">{error}</p> : null}
          </GlassPanel>
        </div>
      </div>
    );
  }

  const kpis = dashboard?.kpis;

  const alerts = [
    (kpis?.retencionMensual ?? 0) < 60
      ? { id: 'retencion', label: 'Retención baja, activa campañas de reenganche', tone: 'warning' as const }
      : null,
    (kpis?.adherenciaNutricional ?? 0) < 50
      ? { id: 'nutricion', label: 'Adherencia nutricional baja, revisar seguimientos', tone: 'warning' as const }
      : null,
    (kpis?.tasaCanje ?? 0) > 45
      ? { id: 'canjes', label: 'Alta tasa de canje, controla stock y beneficios', tone: 'info' as const }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string; tone: 'warning' | 'info' }>;

  return (
    <div className="relative min-h-screen bg-background overflow-hidden selection:bg-indigo-500/30 font-sans pb-20">
      <NoiseTexture />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none translate-y-1/3 -translate-x-1/4" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8 mt-12">
        <HeroPanel>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
                Panel de Control <Activity className="w-8 h-8 text-indigo-400" />
              </h1>
              <p className="text-gray-300 text-lg">Operación premium del gimnasio con foco en retención y crecimiento.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <StatusPill tone="info">es-UY / UYU</StatusPill>
              <StatusPill tone="success">KPI Live</StatusPill>
            </div>
          </div>
          {error ? <p className="text-red-300 mt-4">{error}</p> : null}
        </HeroPanel>

        {alerts.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <TriangleAlert className="w-5 h-5 text-amber-300 mt-0.5" />
              <div className="space-y-1">
                {alerts.map((item) => (
                  <p key={item.id} className="text-sm text-amber-100">{item.label}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <LoadingGrid />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricCard label="Clientes activos" value={kpis?.totalClientesActivos ?? 0} hint="operación diaria" icon={<Users className="w-5 h-5" />} />
            <MetricCard label="Membresías activas" value={kpis?.membresiasActivas ?? 0} hint="renovaciones" icon={<CheckCircle2 className="w-5 h-5" />} />
            <MetricCard label="Ingresos del mes" value={currency.format(kpis?.pagosMes ?? 0)} hint="cobros manuales" icon={<CreditCard className="w-5 h-5" />} />
            <MetricCard label="Retención mensual" value={`${(kpis?.retencionMensual ?? 0).toFixed(1)}%`} hint="meta +10% / 90d" icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Reservas hoy" value={kpis?.reservasConfirmadasHoy ?? 0} hint="clases base" icon={<Zap className="w-5 h-5" />} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard label="Adopción servicios dinámicos" value={`${(kpis?.adopcionServiciosDinamicos ?? 0).toFixed(1)}%`} />
          <MetricCard label="Tasa de canje" value={`${(kpis?.tasaCanje ?? 0).toFixed(1)}%`} />
          <MetricCard label="Participación en retos" value={`${(kpis?.participacionRetos ?? 0).toFixed(1)}%`} />
          <MetricCard label="Adherencia nutricional" value={`${(kpis?.adherenciaNutricional ?? 0).toFixed(1)}%`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard
            title="Builder dinámico"
            description="Publica servicios, gestiona sesiones y opera lista de espera."
            action={
              <Link href="/admin/builder" data-testid="go-admin-builder" className="inline-flex rounded-lg bg-cyan-500/20 px-3 py-2 text-cyan-200 hover:bg-cyan-500/30 text-sm font-medium">
                Abrir builder
              </Link>
            }
          />
          <ActionCard
            title="Comunidad"
            description="Gestiona puntos, premios y canjes con trazabilidad completa."
            action={
              <Link href="/admin/comunidad" data-testid="go-admin-comunidad" className="inline-flex rounded-lg bg-amber-500/20 px-3 py-2 text-amber-200 hover:bg-amber-500/30 text-sm font-medium">
                Abrir comunidad
              </Link>
            }
          />
          <ActionCard
            title="Nutrición"
            description="Consentimiento, planes activos y seguimiento por cliente."
            action={
              <Link href="/admin/nutricion" data-testid="go-admin-nutricion" className="inline-flex rounded-lg bg-rose-500/20 px-3 py-2 text-rose-200 hover:bg-rose-500/30 text-sm font-medium">
                Abrir nutrición
              </Link>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Clientes recientes
            </h2>
            <div className="space-y-3">
              {(dashboard?.recientes.clientes ?? []).length === 0 ? (
                <EmptyState title="Sin registros recientes" description="Los nuevos clientes aparecerán aquí cuando recepción los cree." />
              ) : (
                dashboard?.recientes.clientes.map((client) => (
                  <div key={client.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-white font-medium">{client.nombres} {client.apellidos}</p>
                    <p className="text-xs text-gray-400">{client.email ?? 'Sin email'} • {client.estado}</p>
                  </div>
                ))
              )}
            </div>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Próximos horarios
            </h2>
            <div className="space-y-3">
              {(dashboard?.recientes.horarios ?? []).length === 0 ? (
                <EmptyState title="Sin horarios programados" description="Define horarios base desde gestión de clases." />
              ) : (
                dashboard?.recientes.horarios.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-white font-medium">Clase #{h.clase_base_id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(h.inicio).toLocaleString('es-UY')} - {new Date(h.fin).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-500">Cupo {h.cupo_total} • {h.estado}</p>
                  </div>
                ))
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
