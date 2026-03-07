'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Layers, PlayCircle, Plus, PauseCircle, Users2 } from 'lucide-react';
import { PortalAccessAssistant } from '@/components/gymcrm/PortalAccessAssistant';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { useOpenSession } from '@/hooks/useOpenSession';
import { useUIExperience } from '@/hooks/useUIExperience';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import type { PortalAccessIntent } from '@/lib/gymcrm/demo-ui';
import { toUserErrorMessage } from '@/lib/gymcrm/error';

type ListResponse<T> = { data: T[]; count?: number };

type MeResponse = {
  data: {
    ready: boolean;
    role: {
      rol: string;
    } | null;
  };
};

type BuilderTemplate = {
  key: string;
  nombre: string;
  descripcion: string;
  defaultDefinition: {
    reglas: {
      cupoPorSesion: number;
    };
  };
};

type TemplatesResponse = {
  data: {
    templates: BuilderTemplate[];
  };
};

type BuilderService = {
  id: string;
  slug: string;
  nombre: string;
  modulo_base: string;
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
  cliente_id: string;
  estado: 'confirmada' | 'espera' | 'cancelada' | 'asistio' | 'ausente';
  created_at: string;
};

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const toIso = (localDateTime: string): string => {
  if (!localDateTime) return '';
  return new Date(localDateTime).toISOString();
};
const BUILDER_PORTAL_INTENT: PortalAccessIntent = {
  route: '/admin/builder',
  requiredRoles: ['admin', 'recepcion', 'entrenador', 'nutricionista'],
  recommendedRole: 'admin',
  ctaLabel: 'Entrar como staff demo',
};

export default function AdminBuilderPage() {
  const { role: openRole, ready: sessionReady } = useOpenSession();
  const { fireHaptic } = useUIExperience();

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<BuilderTemplate[]>([]);
  const [services, setServices] = useState<BuilderService[]>([]);
  const [sessions, setSessions] = useState<BuilderSession[]>([]);
  const [reservations, setReservations] = useState<BuilderReservation[]>([]);

  const [serviceName, setServiceName] = useState('');
  const [serviceSlug, setServiceSlug] = useState('');
  const [serviceTemplate, setServiceTemplate] = useState('');
  const serviceNameRef = useRef<HTMLInputElement | null>(null);
  const serviceSlugRef = useRef<HTMLInputElement | null>(null);
  const serviceTemplateRef = useRef<HTMLSelectElement | null>(null);

  const [sessionServiceId, setSessionServiceId] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionStart, setSessionStart] = useState('');
  const [sessionEnd, setSessionEnd] = useState('');
  const [sessionCupo, setSessionCupo] = useState(20);

  const serviceById = useMemo(() => {
    const map: Record<string, BuilderService> = {};
    for (const service of services) {
      map[service.id] = service;
    }
    return map;
  }, [services]);

  const sessionById = useMemo(() => {
    const map: Record<string, BuilderSession> = {};
    for (const session of sessions) {
      map[session.id] = session;
    }
    return map;
  }, [sessions]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const me = await apiGet<MeResponse>('/api/gymcrm/me');
      const canAccess = Boolean(me.data.ready && openRole !== 'cliente');
      setIsReady(canAccess);

      if (!canAccess) {
        setTemplates([]);
        setServices([]);
        setSessions([]);
        setReservations([]);
        return;
      }

      const [templatesResp, servicesResp, sessionsResp, reservationsResp] = await Promise.all([
        apiGet<TemplatesResponse>('/api/gymcrm/builder/plantillas'),
        apiGet<ListResponse<BuilderService>>('/api/gymcrm/builder/servicios?pageSize=100'),
        apiGet<ListResponse<BuilderSession>>('/api/gymcrm/builder/sesiones?pageSize=100'),
        apiGet<ListResponse<BuilderReservation>>('/api/gymcrm/builder/reservas?pageSize=150'),
      ]);

      const nextTemplates = templatesResp.data.templates ?? [];
      const nextServices = servicesResp.data ?? [];

      setTemplates(nextTemplates);
      setServices(nextServices);
      setSessions(sessionsResp.data ?? []);
      setReservations(reservationsResp.data ?? []);

      setServiceTemplate((current) => {
        if (current && nextTemplates.some((template) => template.key === current)) return current;
        return nextTemplates[0]?.key ?? '';
      });

      setSessionServiceId((current) => {
        if (current && nextServices.some((service) => service.id === current)) return current;
        return nextServices[0]?.id ?? '';
      });
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar Builder Admin.'));
      setTemplates([]);
      setServices([]);
      setSessions([]);
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, [openRole]);

  useEffect(() => {
    if (!sessionReady) return;
    loadData();
  }, [loadData, sessionReady, openRole]);

  const createService = async () => {
    try {
      const safeName = serviceName.trim() || serviceNameRef.current?.value.trim() || '';
      const safeTemplate = serviceTemplate || serviceTemplateRef.current?.value || '';
      const safeSlugSource = serviceSlug || serviceSlugRef.current?.value || '';

      if (!safeName || !safeTemplate) {
        setError('Nombre y plantilla son obligatorios para crear servicio.');
        fireHaptic('warning');
        return;
      }

      const slug = toSlug(safeSlugSource || safeName);
      if (!slug) {
        setError('No se pudo generar slug válido para el servicio.');
        fireHaptic('warning');
        return;
      }

      const optimisticId = `tmp-${Date.now()}`;
      const optimisticService: BuilderService = {
        id: optimisticId,
        slug,
        nombre: safeName,
        modulo_base: safeTemplate,
        estado: 'borrador',
        activo: true,
      };

      setServices((current) => [optimisticService, ...current.filter((item) => item.id !== optimisticId)]);
      setSessionServiceId(optimisticId);

      const created = await apiMutation<{ data?: { servicio?: BuilderService } }>('/api/gymcrm/builder/servicios', 'POST', {
        nombre: safeName,
        slug,
        plantilla: safeTemplate,
      });

      const createdService = created?.data?.servicio;
      if (createdService) {
        setServices((current) => {
          const withoutExisting = current.filter(
            (item) => item.id !== createdService.id && item.id !== optimisticId
          );
          return [createdService, ...withoutExisting];
        });
        setSessionServiceId(createdService.id);
      }

      setServiceName('');
      setServiceSlug('');
      setError(null);
      fireHaptic('success');
    } catch (err) {
      setServices((current) => current.filter((item) => !item.id.startsWith('tmp-')));
      setError(toUserErrorMessage(err, 'No se pudo crear servicio dinámico.'));
      fireHaptic('error');
    }
  };

  const patchService = async (id: string, payload: Record<string, unknown>) => {
    try {
      await apiMutation(`/api/gymcrm/builder/servicios/${id}`, 'PATCH', payload);
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo actualizar servicio.'));
      fireHaptic('error');
    }
  };

  const createSession = async () => {
    try {
      if (!sessionServiceId || !sessionTitle.trim() || !sessionStart || !sessionEnd) {
        setError('Servicio, título, inicio y fin son obligatorios para crear sesión.');
        fireHaptic('warning');
        return;
      }

      await apiMutation('/api/gymcrm/builder/sesiones', 'POST', {
        servicio_id: sessionServiceId,
        titulo: sessionTitle.trim(),
        inicio: toIso(sessionStart),
        fin: toIso(sessionEnd),
        cupo_total: sessionCupo,
      });

      setSessionTitle('');
      setSessionStart('');
      setSessionEnd('');
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo crear sesión dinámica.'));
      fireHaptic('error');
    }
  };

  const patchReservation = async (id: string, estado: BuilderReservation['estado']) => {
    try {
      await apiMutation(`/api/gymcrm/builder/reservas/${id}`, 'PATCH', { estado });
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo actualizar reserva dinámica.'));
      fireHaptic('error');
    }
  };

  const reservationRows = useMemo(() => {
    return [...reservations]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 40);
  }, [reservations]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[70vh] text-gray-400">Cargando builder...</div>;
  }

  if (openRole === 'cliente') {
    return (
      <PortalAccessAssistant
        intent={BUILDER_PORTAL_INTENT}
        currentRole={openRole}
        title="Builder admin en modo demo"
        description="Este módulo se prueba con rol staff. Cambia el rol para crear servicios, sesiones y gestionar reservas."
        error={error}
      />
    );
  }

  if (!isReady) {

    return (
      <div className="relative min-h-screen bg-background overflow-hidden">
        <NoiseTexture />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
          <GlassPanel>
            <h1 className="text-3xl font-bold text-white mb-3">Acceso restringido</h1>
            <p className="text-gray-300">Builder admin requiere rol staff y gym inicializado.</p>
            {error ? <p className="mt-4 text-red-300">{error}</p> : null}
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden pb-20">
      <NoiseTexture />
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-6 mt-12">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold text-white flex items-center gap-2">
            Builder Admin <Layers className="w-7 h-7 text-cyan-400" />
          </h1>
          <p className="text-gray-400">Configura servicios dinámicos, agenda sesiones y opera reservas.</p>
          {error ? <p className="text-red-300 text-sm">{error}</p> : null}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel>
            <h2 className="text-white font-semibold mb-4">Nuevo servicio</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                ref={serviceNameRef}
                value={serviceName}
                onChange={(event) => setServiceName(event.target.value)}
                placeholder="Nombre (ej: Spinning Pro)"
                data-testid="builder-service-name"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <input
                ref={serviceSlugRef}
                value={serviceSlug}
                onChange={(event) => setServiceSlug(event.target.value)}
                placeholder="Slug (opcional)"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <select
                ref={serviceTemplateRef}
                value={serviceTemplate}
                onChange={(event) => setServiceTemplate(event.target.value)}
                data-testid="builder-service-template"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              >
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.nombre}
                  </option>
                ))}
              </select>
              <button
                onClick={createService}
                data-testid="builder-create-service"
                className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2.5">
                  <Plus className="w-4 h-4" /> Crear servicio
                </span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">Plantillas base: clase grupal, artes marciales, cancha, sesión personal y evento outdoor.</p>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-white font-semibold mb-4">Nueva sesión</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={sessionServiceId}
                onChange={(event) => setSessionServiceId(event.target.value)}
                data-testid="builder-session-service"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="">Selecciona servicio</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.nombre}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={sessionCupo}
                onChange={(event) => setSessionCupo(Number(event.target.value))}
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <input
                value={sessionTitle}
                onChange={(event) => setSessionTitle(event.target.value)}
                placeholder="Título sesión"
                data-testid="builder-session-title"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white md:col-span-2"
              />
              <input
                type="datetime-local"
                value={sessionStart}
                onChange={(event) => setSessionStart(event.target.value)}
                data-testid="builder-session-start"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <input
                type="datetime-local"
                value={sessionEnd}
                onChange={(event) => setSessionEnd(event.target.value)}
                data-testid="builder-session-end"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <button
                onClick={createSession}
                data-testid="builder-create-session"
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold md:col-span-2"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2.5">
                  <CalendarDays className="w-4 h-4" /> Crear sesión
                </span>
              </button>
            </div>
          </GlassPanel>
        </div>

        <GlassPanel>
          <h2 className="text-white font-semibold mb-4">Servicios activos y estado operativo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {services.map((service) => (
              <div key={service.id} className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                <div>
                  <p className="text-white font-semibold">{service.nombre}</p>
                  <p className="text-xs text-gray-400">{service.slug} • plantilla {service.modulo_base}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-white/10 text-gray-200 uppercase">{service.estado}</span>
                  <span className={`px-2 py-1 rounded-full uppercase ${service.activo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                    {service.activo ? 'activo' : 'inactivo'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => patchService(service.id, { estado: 'publicado', activo: true })}
                    data-testid={`builder-publicar-${service.id}`}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs"
                  >
                    <span className="inline-flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" /> Publicar</span>
                  </button>
                  <button
                    onClick={() => patchService(service.id, { estado: 'pausado', activo: false })}
                    data-testid={`builder-pausar-${service.id}`}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs"
                  >
                    <span className="inline-flex items-center gap-1"><PauseCircle className="w-3.5 h-3.5" /> Pausar</span>
                  </button>
                  <button
                    onClick={() => patchService(service.id, { estado: 'borrador', activo: true })}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 hover:bg-white/20 text-xs"
                  >
                    Volver a borrador
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users2 className="w-4 h-4 text-cyan-300" />
            Reservas dinámicas (últimas 40)
          </h2>
          <div className="space-y-3">
            {reservationRows.length === 0 ? (
              <p className="text-sm text-gray-500">Sin reservas dinámicas aún.</p>
            ) : (
              reservationRows.map((reservation) => {
                const session = sessionById[reservation.sesion_id];
                const service = session ? serviceById[session.servicio_id] : null;

                return (
                  <div key={reservation.id} className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-medium">{session?.titulo ?? `Sesión ${reservation.sesion_id.slice(0, 8)}`}</p>
                      <p className="text-xs text-gray-400">
                        {service?.nombre ?? 'Servicio'} • cliente {reservation.cliente_id.slice(0, 8)} • {reservation.estado}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {reservation.estado !== 'asistio' ? (
                        <button
                          onClick={() => patchReservation(reservation.id, 'asistio')}
                          data-testid={`builder-reserva-asistio-${reservation.id}`}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs"
                        >
                          Marcar asistió
                        </button>
                      ) : null}
                      {reservation.estado !== 'ausente' ? (
                        <button
                          onClick={() => patchReservation(reservation.id, 'ausente')}
                          data-testid={`builder-reserva-ausente-${reservation.id}`}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs"
                        >
                          Marcar ausente
                        </button>
                      ) : null}
                      {reservation.estado !== 'cancelada' ? (
                        <button
                          onClick={() => patchReservation(reservation.id, 'cancelada')}
                          data-testid={`builder-reserva-cancelar-${reservation.id}`}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
