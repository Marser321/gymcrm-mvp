'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, CreditCard, QrCode, ShieldCheck, Trophy, Zap } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { PortalAccessAssistant } from '@/components/gymcrm/PortalAccessAssistant';
import { useOpenSession } from '@/hooks/useOpenSession';
import { useUIExperience } from '@/hooks/useUIExperience';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import type { PortalAccessIntent } from '@/lib/gymcrm/demo-ui';
import { toUserErrorMessage } from '@/lib/gymcrm/error';

type MeResponse = {
  data: {
    ready: boolean;
    role: {
      rol: string;
    } | null;
    cliente: {
      id: string;
      nombres: string;
      apellidos: string;
      email: string | null;
      codigo_qr: string;
      estado: string;
    } | null;
  };
};

type ListResponse<T> = { data: T[]; count?: number };

type Membership = {
  id: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  plan_id: string;
};

type Payment = {
  id: string;
  monto: number;
  moneda: string;
  estado: string;
  fecha_pago: string;
  metodo: string;
};

type Reservation = {
  id: string;
  horario_id: string;
  estado: string;
  created_at: string;
};

type PointsMovement = {
  id: string;
  puntos: number;
  motivo: string;
  created_at: string;
};

type Canje = {
  id: string;
  estado: 'solicitado' | 'aprobado' | 'rechazado' | 'entregado' | 'anulado';
  puntos: number;
  created_at: string;
};

type RankingEntry = {
  posicion: number;
  nombre: string;
  puntos: number;
};

type BuilderService = {
  id: string;
  nombre: string;
  estado: 'borrador' | 'publicado' | 'pausado';
  activo: boolean;
};

type BuilderSession = {
  id: string;
  servicio_id: string;
  titulo: string;
  inicio: string;
  fin: string;
  cupo_total: number;
  estado: 'programada' | 'cancelada' | 'finalizada';
};

type BuilderReservation = {
  id: string;
  sesion_id: string;
  estado: 'confirmada' | 'espera' | 'cancelada' | 'asistio' | 'ausente';
  created_at: string;
};

type Premio = {
  id: string;
  nombre: string;
  tipo: 'descuento_pago' | 'pase_servicio';
  costo_puntos: number;
  monto_descuento: number | null;
  stock_disponible: number | null;
};

type Consentimiento = {
  id: string;
  version_texto: string;
  medio: 'app' | 'staff';
  activo: boolean;
  revocado_en: string | null;
  aceptado_en: string;
};

type PlanNutricion = {
  id: string;
  estado: 'borrador' | 'activo' | 'sustituido' | 'cerrado';
  objetivo_general: string | null;
  notas: string | null;
};

type Medicion = {
  id: string;
  fecha_medicion: string;
  adherencia_pct: number | null;
  peso_kg: number | null;
  notas: string | null;
};

const DEFAULT_CONSENT_TEXT =
  'Acepto el seguimiento nutricional no clínico del centro, con fines educativos y de mejora de hábitos saludables.';

const CLIENT_PORTAL_INTENT: PortalAccessIntent = {
  route: '/cliente',
  requiredRoles: ['cliente'],
  recommendedRole: 'cliente',
  ctaLabel: 'Entrar como cliente demo',
};

export default function ClientePage() {
  const { role: openRole, ready: sessionReady } = useOpenSession();
  const { fireHaptic } = useUIExperience();

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrImageError, setQrImageError] = useState(false);

  const [me, setMe] = useState<MeResponse['data'] | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsHistory, setPointsHistory] = useState<PointsMovement[]>([]);
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  const [services, setServices] = useState<BuilderService[]>([]);
  const [sessions, setSessions] = useState<BuilderSession[]>([]);
  const [dynamicReservations, setDynamicReservations] = useState<BuilderReservation[]>([]);

  const [premios, setPremios] = useState<Premio[]>([]);
  const [selectedPremioId, setSelectedPremioId] = useState('');

  const [consentimientos, setConsentimientos] = useState<Consentimiento[]>([]);
  const [planes, setPlanes] = useState<PlanNutricion[]>([]);
  const [mediciones, setMediciones] = useState<Medicion[]>([]);

  const [consentText, setConsentText] = useState(DEFAULT_CONSENT_TEXT);
  const [adherencia, setAdherencia] = useState<number | ''>(75);
  const [seguimientoNotas, setSeguimientoNotas] = useState('');

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: 'UYU',
        maximumFractionDigits: 0,
      }),
    []
  );

  const serviceById = useMemo(() => {
    const map: Record<string, BuilderService> = {};
    for (const service of services) map[service.id] = service;
    return map;
  }, [services]);

  const sessionById = useMemo(() => {
    const map: Record<string, BuilderSession> = {};
    for (const session of sessions) map[session.id] = session;
    return map;
  }, [sessions]);

  const activeMembership = useMemo(() => memberships.find((item) => item.estado === 'activa') ?? memberships[0], [memberships]);
  const activeConsent = useMemo(
    () => consentimientos.find((item) => item.activo && !item.revocado_en) ?? null,
    [consentimientos]
  );
  const activePlan = useMemo(() => planes.find((item) => item.estado === 'activo') ?? null, [planes]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setQrImageError(false);

    try {
      const meResp = await apiGet<MeResponse>('/api/gymcrm/me');
      setMe(meResp.data);

      if (!meResp.data.ready || !meResp.data.cliente) {
        setMemberships([]);
        setPayments([]);
        setReservations([]);
        setPointsBalance(0);
        setPointsHistory([]);
        setCanjes([]);
        setRanking([]);
        setServices([]);
        setSessions([]);
        setDynamicReservations([]);
        setPremios([]);
        setConsentimientos([]);
        setPlanes([]);
        setMediciones([]);
        return;
      }

      const [
        membresiasResp,
        pagosResp,
        reservasResp,
        puntosResp,
        canjesResp,
        rankingResp,
        serviciosResp,
        sesionesResp,
        reservasDynResp,
        premiosResp,
        consentResp,
        planesResp,
        medsResp,
      ] = await Promise.all([
        apiGet<ListResponse<Membership>>('/api/gymcrm/membresias?pageSize=50'),
        apiGet<ListResponse<Payment>>('/api/gymcrm/pagos?pageSize=50'),
        apiGet<ListResponse<Reservation>>('/api/gymcrm/reservas?pageSize=50'),
        apiGet<{ data: PointsMovement[]; count: number; balance: number }>('/api/gymcrm/comunidad/puntos?pageSize=50'),
        apiGet<ListResponse<Canje>>('/api/gymcrm/comunidad/canjes?pageSize=50'),
        apiGet<{ data: { month: string; ranking: RankingEntry[] } }>('/api/gymcrm/comunidad/ranking?limit=5'),
        apiGet<ListResponse<BuilderService>>('/api/gymcrm/builder/servicios?active=true&estado=publicado&pageSize=100'),
        apiGet<ListResponse<BuilderSession>>('/api/gymcrm/builder/sesiones?estado=programada&pageSize=100'),
        apiGet<ListResponse<BuilderReservation>>('/api/gymcrm/builder/reservas?pageSize=80'),
        apiGet<ListResponse<Premio>>('/api/gymcrm/comunidad/premios?activa=true&pageSize=80'),
        apiGet<ListResponse<Consentimiento>>('/api/gymcrm/nutricion/consentimientos?active=true&pageSize=20'),
        apiGet<ListResponse<PlanNutricion>>('/api/gymcrm/nutricion/planes?pageSize=20'),
        apiGet<ListResponse<Medicion>>('/api/gymcrm/nutricion/mediciones?pageSize=50'),
      ]);

      const nextPremios = premiosResp.data ?? [];

      setMemberships(membresiasResp.data ?? []);
      setPayments(pagosResp.data ?? []);
      setReservations(reservasResp.data ?? []);
      setPointsBalance(puntosResp.balance ?? 0);
      setPointsHistory(puntosResp.data ?? []);
      setCanjes(canjesResp.data ?? []);
      setRanking(rankingResp.data?.ranking ?? []);
      setServices(serviciosResp.data ?? []);
      setSessions(sesionesResp.data ?? []);
      setDynamicReservations(reservasDynResp.data ?? []);
      setPremios(nextPremios);
      setConsentimientos(consentResp.data ?? []);
      setPlanes(planesResp.data ?? []);
      setMediciones(medsResp.data ?? []);

      setSelectedPremioId((current) => {
        if (current && nextPremios.some((premio) => premio.id === current)) return current;
        return nextPremios[0]?.id ?? '';
      });
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar portal cliente.'));
      setMemberships([]);
      setPayments([]);
      setReservations([]);
      setPointsBalance(0);
      setPointsHistory([]);
      setCanjes([]);
      setRanking([]);
      setServices([]);
      setSessions([]);
      setDynamicReservations([]);
      setPremios([]);
      setConsentimientos([]);
      setPlanes([]);
      setMediciones([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    loadData();
  }, [loadData, sessionReady, openRole]);

  const reserveDynamicSession = async (sesionId: string) => {
    setIsMutating(true);
    setError(null);
    try {
      await apiMutation('/api/gymcrm/builder/reservas', 'POST', {
        sesion_id: sesionId,
      });
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo reservar la sesión dinámica.'));
      fireHaptic('error');
    } finally {
      setIsMutating(false);
    }
  };

  const cancelDynamicReservation = async (reservaId: string) => {
    setIsMutating(true);
    setError(null);
    try {
      await apiMutation(`/api/gymcrm/builder/reservas/${reservaId}`, 'PATCH', {
        estado: 'cancelada',
      });
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cancelar la reserva dinámica.'));
      fireHaptic('error');
    } finally {
      setIsMutating(false);
    }
  };

  const requestCanje = async () => {
    setIsMutating(true);
    setError(null);
    try {
      if (!selectedPremioId) {
        setError('Selecciona un premio para solicitar canje.');
        fireHaptic('warning');
        return;
      }

      await apiMutation('/api/gymcrm/comunidad/canjes', 'POST', {
        premio_id: selectedPremioId,
      });
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo solicitar el canje.'));
      fireHaptic('error');
    } finally {
      setIsMutating(false);
    }
  };

  const acceptConsent = async () => {
    setIsMutating(true);
    setError(null);
    try {
      if (!consentText.trim()) {
        setError('El texto de consentimiento no puede estar vacío.');
        fireHaptic('warning');
        return;
      }

      await apiMutation('/api/gymcrm/nutricion/consentimientos', 'POST', {
        version_texto: consentText.trim(),
        medio: 'app',
      });

      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo registrar consentimiento.'));
      fireHaptic('error');
    } finally {
      setIsMutating(false);
    }
  };

  const saveSeguimiento = async () => {
    setIsMutating(true);
    setError(null);
    try {
      await apiMutation('/api/gymcrm/nutricion/mediciones', 'POST', {
        plan_id: activePlan?.id ?? null,
        adherencia_pct: adherencia === '' ? null : Number(adherencia),
        notas: seguimientoNotas.trim() || null,
      });

      setSeguimientoNotas('');
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo guardar seguimiento nutricional.'));
      fireHaptic('error');
    } finally {
      setIsMutating(false);
    }
  };

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((session) => new Date(session.inicio).getTime() >= now)
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
      .slice(0, 50);
  }, [sessions]);

  const lastMedicion = mediciones[0] ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] text-gray-400">Cargando portal cliente...</div>
    );
  }

  if (!me?.ready || !me?.cliente) {
    if (openRole !== 'cliente') {
      return (
        <PortalAccessAssistant
          intent={CLIENT_PORTAL_INTENT}
          currentRole={openRole}
          title="Portal cliente en modo demo"
          description="Este portal se prueba con rol cliente. Cambia el rol y entra directo para recorrer reservas, canjes y nutricion."
          error={error}
        />
      );
    }

    return (
      <div className="relative min-h-screen bg-background overflow-hidden pb-20">
        <NoiseTexture />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
          <GlassPanel>
            <h1 className="text-3xl font-bold text-white mb-3">Portal cliente sin perfil vinculado</h1>
            <p className="text-gray-300">
              Esta sesion ya esta en rol cliente, pero no tiene ficha activa asociada. Crea o vincula cliente desde admin para probar el flujo completo.
            </p>
            {error ? <p className="mt-4 text-red-300">{error}</p> : null}
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden selection:bg-indigo-500/30 pb-20">
      <NoiseTexture />

      <div className="absolute top-0 right-0 w-[650px] h-[650px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none translate-y-1/3 -translate-x-1/4" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 space-y-6 mt-12">
        <header>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">Portal Cliente</h1>
          <p className="text-gray-400 text-lg">Bienvenido {me.cliente.nombres}. Gestiona tu membresía, reservas, canjes y nutrición.</p>
          {error ? <p className="text-red-300 mt-3">{error}</p> : null}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Membresía</h2>
            {activeMembership ? (
              <>
                <p className="text-sm text-gray-300">Estado: <span className="text-white font-semibold uppercase">{activeMembership.estado}</span></p>
                <p className="text-sm text-gray-400 mt-2">Inicio: {new Date(activeMembership.fecha_inicio).toLocaleDateString('es-UY')}</p>
                <p className="text-sm text-gray-400">Vencimiento: {new Date(activeMembership.fecha_fin).toLocaleDateString('es-UY')}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Sin membresía activa.</p>
            )}
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-3 flex items-center gap-2"><CreditCard className="w-5 h-5 text-violet-400" /> Pagos</h2>
            <p className="text-3xl font-bold text-white">{payments.length}</p>
            <p className="text-sm text-gray-400 mt-1">Registros en historial</p>
            {payments[0] ? (
              <p className="text-sm text-emerald-300 mt-3">Último: {currency.format(payments[0].monto)} ({payments[0].estado})</p>
            ) : null}
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-3 flex items-center gap-2"><Calendar className="w-5 h-5 text-amber-400" /> Reservas base</h2>
            <p className="text-3xl font-bold text-white">{reservations.length}</p>
            <p className="text-sm text-gray-400 mt-1">Clases tradicionales</p>
            <Link href="/dashboard/classes" className="inline-block mt-4 text-sm text-indigo-300 hover:text-indigo-200 underline">
              Ir a reservar/cancelar clases base
            </Link>
          </GlassPanel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-4 flex items-center gap-2"><QrCode className="w-5 h-5 text-indigo-400" /> QR de check-in</h2>
            <div className="flex flex-col md:flex-row items-center gap-6">
              {qrImageError ? (
                <div className="w-[220px] h-[220px] rounded-xl border border-white/10 bg-black/35 flex items-center justify-center p-4 text-center">
                  <div>
                    <QrCode className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-300">No se pudo cargar el QR remoto.</p>
                    <p className="text-xs text-gray-400 mt-1 break-all">{me.cliente.codigo_qr}</p>
                  </div>
                </div>
              ) : (
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(me.cliente.codigo_qr)}`}
                  alt="Código QR de check-in"
                  width={220}
                  height={220}
                  onError={() => setQrImageError(true)}
                  className="rounded-xl border border-white/10 bg-white"
                />
              )}
              <div>
                <p className="text-sm text-gray-300">Código: <span className="text-white font-mono">{me.cliente.codigo_qr}</span></p>
                <p className="text-sm text-gray-400 mt-3">Presenta este QR en recepción para registrar asistencia rápida.</p>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-400" /> Comunidad y retos</h2>
            <p className="text-sm text-gray-300">Saldo actual: <span className="text-white font-semibold">{pointsBalance} pts</span></p>
            <p className="text-sm text-gray-400 mt-2">Canjes: {canjes.length} ({canjes.filter((item) => item.estado === 'solicitado').length} pendientes)</p>
            <p className="text-sm text-gray-400 mt-2">Movimientos recientes: {pointsHistory.length}</p>
            <div className="mt-4 space-y-2">
              {ranking.length === 0 ? (
                <p className="text-sm text-gray-500">Sin ranking disponible este mes.</p>
              ) : (
                ranking.map((entry) => (
                  <p key={`${entry.posicion}-${entry.nombre}`} className="text-sm text-gray-300">
                    #{entry.posicion} {entry.nombre} - <span className="text-amber-300">{entry.puntos} pts</span>
                  </p>
                ))
              )}
            </div>
          </GlassPanel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-cyan-400" /> Servicios dinámicos</h2>
            <div className="space-y-3">
              {upcomingSessions.length === 0 ? (
                <p className="text-sm text-gray-500">No hay sesiones dinámicas programadas.</p>
              ) : (
                upcomingSessions.map((session) => {
                  const service = serviceById[session.servicio_id];
                  return (
                    <div key={session.id} className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-white text-sm font-medium">{session.titulo}</p>
                        <p className="text-xs text-gray-400">
                          {service?.nombre ?? 'Servicio'} • {new Date(session.inicio).toLocaleString('es-UY')} • cupo {session.cupo_total}
                        </p>
                      </div>
                      <button
                        disabled={isMutating}
                        onClick={() => reserveDynamicSession(session.id)}
                        data-testid={`cliente-reservar-sesion-${session.id}`}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs disabled:opacity-60"
                      >
                        Reservar
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-4">Mis reservas dinámicas</h2>
            <div className="space-y-3">
              {dynamicReservations.length === 0 ? (
                <p className="text-sm text-gray-500">Aún no tienes reservas dinámicas.</p>
              ) : (
                dynamicReservations.map((reservation) => {
                  const session = sessionById[reservation.sesion_id];
                  return (
                    <div key={reservation.id} className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-white text-sm font-medium">{session?.titulo ?? `Sesión ${reservation.sesion_id.slice(0, 8)}`}</p>
                        <p className="text-xs text-gray-400">
                          estado {reservation.estado}
                          {session ? ` • ${new Date(session.inicio).toLocaleString('es-UY')}` : ''}
                        </p>
                      </div>
                      {reservation.estado !== 'cancelada' ? (
                        <button
                          disabled={isMutating}
                          onClick={() => cancelDynamicReservation(reservation.id)}
                          data-testid={`cliente-cancelar-reserva-${reservation.id}`}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </GlassPanel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-4">Solicitar canje</h2>
            <div className="space-y-3">
              <select
                value={selectedPremioId}
                onChange={(event) => setSelectedPremioId(event.target.value)}
                data-testid="cliente-select-premio"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="">Selecciona premio</option>
                {premios.map((premio) => (
                  <option key={premio.id} value={premio.id}>
                    {premio.nombre} ({premio.costo_puntos} pts)
                  </option>
                ))}
              </select>
              {selectedPremioId ? (
                <p className="text-xs text-gray-400">
                  {(() => {
                    const premio = premios.find((item) => item.id === selectedPremioId);
                    if (!premio) return '';
                    if (premio.tipo === 'descuento_pago') {
                      return `Premio descuento: ${currency.format(premio.monto_descuento ?? 0)}.`;
                    }
                    return 'Premio tipo pase de servicio.';
                  })()}
                </p>
              ) : null}
              <button
                disabled={isMutating}
                onClick={requestCanje}
                data-testid="cliente-request-canje"
                className="rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2.5">Solicitar canje</span>
              </button>
              <div className="pt-2 border-t border-white/10 space-y-1">
                {canjes.slice(0, 5).map((canje) => (
                  <p key={canje.id} className="text-xs text-gray-300">
                    {new Date(canje.created_at).toLocaleDateString('es-UY')} • {canje.estado} • {canje.puntos} pts
                  </p>
                ))}
              </div>
            </div>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-lg text-white font-semibold mb-4">Nutrición y consentimiento</h2>
            <div className="space-y-3">
              {activeConsent ? (
                <p className="text-sm text-emerald-300">
                  Consentimiento vigente ({activeConsent.medio}) desde {new Date(activeConsent.aceptado_en).toLocaleDateString('es-UY')}.
                </p>
              ) : (
                <>
                  <p className="text-sm text-amber-300">No tienes consentimiento activo. Debes aceptarlo para activar plan.</p>
                  <textarea
                    value={consentText}
                    onChange={(event) => setConsentText(event.target.value)}
                    rows={3}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  />
                  <button
                    disabled={isMutating}
                    onClick={acceptConsent}
                    data-testid="cliente-accept-consent"
                    className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-2 px-4 py-2.5">Aceptar consentimiento</span>
                  </button>
                </>
              )}

              <div className="pt-2 border-t border-white/10">
                <p className="text-sm text-gray-300">
                  Plan activo: <span className="text-white font-semibold">{activePlan?.estado ?? 'sin plan activo'}</span>
                </p>
                {activePlan?.objetivo_general ? <p className="text-xs text-gray-400 mt-1">Objetivo: {activePlan.objetivo_general}</p> : null}
              </div>

              <div className="space-y-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={adherencia}
                  onChange={(event) => setAdherencia(event.target.value === '' ? '' : Number(event.target.value))}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Adherencia %"
                />
                <input
                  value={seguimientoNotas}
                  onChange={(event) => setSeguimientoNotas(event.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Notas de seguimiento"
                />
                <button
                  disabled={isMutating}
                  onClick={saveSeguimiento}
                  data-testid="cliente-save-seguimiento"
                  className="rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2 px-4 py-2.5">Guardar seguimiento</span>
                </button>
              </div>

              {lastMedicion ? (
                <p className="text-xs text-gray-400">
                  Último seguimiento: {lastMedicion.fecha_medicion} • adherencia {lastMedicion.adherencia_pct ?? '-'}%
                  {lastMedicion.peso_kg ? ` • peso ${lastMedicion.peso_kg}kg` : ''}
                </p>
              ) : (
                <p className="text-xs text-gray-500">Sin mediciones aún.</p>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
