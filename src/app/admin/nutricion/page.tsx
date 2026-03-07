'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, HeartPulse, Plus, Scale, ShieldCheck } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { useUIExperience } from '@/hooks/useUIExperience';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
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

type Cliente = {
  id: string;
  nombres: string;
  apellidos: string;
};

type Consentimiento = {
  id: string;
  cliente_id: string;
  medio: 'app' | 'staff';
  version_texto: string;
  activo: boolean;
  aceptado_en: string;
  revocado_en: string | null;
};

type PlanNutricion = {
  id: string;
  cliente_id: string;
  consentimiento_id: string | null;
  estado: 'borrador' | 'activo' | 'sustituido' | 'cerrado';
  objetivo_general: string | null;
  notas: string | null;
  updated_at: string;
};

type Medicion = {
  id: string;
  cliente_id: string;
  plan_id: string | null;
  peso_kg: number | null;
  adherencia_pct: number | null;
  fecha_medicion: string;
  notas: string | null;
};

const DEFAULT_CONSENT_TEXT =
  'Acepto el seguimiento nutricional no clínico del centro, con fines educativos y de mejora de hábitos saludables.';

export default function AdminNutricionPage() {
  const { fireHaptic } = useUIExperience();

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [consentimientos, setConsentimientos] = useState<Consentimiento[]>([]);
  const [planes, setPlanes] = useState<PlanNutricion[]>([]);
  const [mediciones, setMediciones] = useState<Medicion[]>([]);

  const [consentClienteId, setConsentClienteId] = useState('');
  const [consentText, setConsentText] = useState(DEFAULT_CONSENT_TEXT);

  const [planClienteId, setPlanClienteId] = useState('');
  const [planEstado, setPlanEstado] = useState<'borrador' | 'activo'>('borrador');
  const [planObjetivo, setPlanObjetivo] = useState('Mejorar composición corporal y adherencia semanal.');
  const [planNotas, setPlanNotas] = useState('');

  const [medClienteId, setMedClienteId] = useState('');
  const [medPlanId, setMedPlanId] = useState('');
  const [medPeso, setMedPeso] = useState<number | ''>('');
  const [medAdherencia, setMedAdherencia] = useState<number | ''>(75);
  const [medNotas, setMedNotas] = useState('');

  const clientesById = useMemo(() => {
    const map: Record<string, Cliente> = {};
    for (const cliente of clientes) {
      map[cliente.id] = cliente;
    }
    return map;
  }, [clientes]);

  const activeConsentsByClient = useMemo(() => {
    const map: Record<string, Consentimiento> = {};
    for (const consent of consentimientos) {
      if (consent.activo && !consent.revocado_en && !map[consent.cliente_id]) {
        map[consent.cliente_id] = consent;
      }
    }
    return map;
  }, [consentimientos]);

  const plansByClient = useMemo(() => {
    const map: Record<string, PlanNutricion[]> = {};
    for (const plan of planes) {
      if (!map[plan.cliente_id]) map[plan.cliente_id] = [];
      map[plan.cliente_id].push(plan);
    }
    return map;
  }, [planes]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const me = await apiGet<MeResponse>('/api/gymcrm/me');
      const role = me.data.role?.rol ?? '';
      const canAccess = Boolean(me.data.ready && role !== 'cliente' && (role === 'admin' || role === 'nutricionista'));
      setIsReady(canAccess);

      if (!canAccess) {
        setClientes([]);
        setConsentimientos([]);
        setPlanes([]);
        setMediciones([]);
        return;
      }

      const [clientesResp, consentResp, plansResp, medsResp] = await Promise.all([
        apiGet<ListResponse<Cliente>>('/api/gymcrm/clientes?pageSize=200'),
        apiGet<ListResponse<Consentimiento>>('/api/gymcrm/nutricion/consentimientos?pageSize=200'),
        apiGet<ListResponse<PlanNutricion>>('/api/gymcrm/nutricion/planes?pageSize=150'),
        apiGet<ListResponse<Medicion>>('/api/gymcrm/nutricion/mediciones?pageSize=150'),
      ]);

      setClientes(clientesResp.data ?? []);
      setConsentimientos(consentResp.data ?? []);
      setPlanes(plansResp.data ?? []);
      setMediciones(medsResp.data ?? []);

      if (!consentClienteId && (clientesResp.data?.length ?? 0) > 0) {
        setConsentClienteId(clientesResp.data[0].id);
      }

      if (!planClienteId && (clientesResp.data?.length ?? 0) > 0) {
        setPlanClienteId(clientesResp.data[0].id);
      }

      if (!medClienteId && (clientesResp.data?.length ?? 0) > 0) {
        const firstClientId = clientesResp.data[0].id;
        setMedClienteId(firstClientId);
      }
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar nutrición admin.'));
      setClientes([]);
      setConsentimientos([]);
      setPlanes([]);
      setMediciones([]);
    } finally {
      setIsLoading(false);
    }
  }, [consentClienteId, medClienteId, planClienteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!medClienteId) return;
    const plansForClient = plansByClient[medClienteId] ?? [];
    if (plansForClient.length > 0) {
      if (!plansForClient.some((plan) => plan.id === medPlanId)) {
        setMedPlanId(plansForClient[0].id);
      }
    } else {
      setMedPlanId('');
    }
  }, [medClienteId, plansByClient, medPlanId]);

  const createConsent = async () => {
    try {
      if (!consentClienteId || !consentText.trim()) {
        setError('cliente y texto de consentimiento son obligatorios.');
        fireHaptic('warning');
        return;
      }

      await apiMutation('/api/gymcrm/nutricion/consentimientos', 'POST', {
        cliente_id: consentClienteId,
        medio: 'staff',
        version_texto: consentText.trim(),
      });

      await loadData();
      fireHaptic('success');
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo registrar consentimiento.'));
      fireHaptic('error');
    }
  };

  const createPlan = async () => {
    try {
      if (!planClienteId) {
        setError('cliente es obligatorio para crear plan.');
        fireHaptic('warning');
        return;
      }

      const recomendaciones = planNotas
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      await apiMutation('/api/gymcrm/nutricion/planes', 'POST', {
        cliente_id: planClienteId,
        consentimiento_id: activeConsentsByClient[planClienteId]?.id ?? null,
        estado: planEstado,
        objetivo_general: planObjetivo.trim() || null,
        notas: planNotas.trim() || null,
        version_inicial: {
          contenido: {
            comidas: [],
            recomendaciones,
            habitos: [],
          },
          notas: 'Versión inicial creada desde panel admin',
          publicado: planEstado === 'activo',
        },
      });

      await loadData();
      fireHaptic('success');
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo crear plan nutricional.'));
      fireHaptic('error');
    }
  };

  const createMedicion = async () => {
    try {
      if (!medClienteId) {
        setError('cliente es obligatorio para registrar medición.');
        fireHaptic('warning');
        return;
      }

      await apiMutation('/api/gymcrm/nutricion/mediciones', 'POST', {
        cliente_id: medClienteId,
        plan_id: medPlanId || null,
        peso_kg: medPeso === '' ? null : Number(medPeso),
        adherencia_pct: medAdherencia === '' ? null : Number(medAdherencia),
        notas: medNotas.trim() || null,
      });

      setMedNotas('');
      await loadData();
      fireHaptic('success');
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo registrar medición.'));
      fireHaptic('error');
    }
  };

  const patchPlanState = async (id: string, estado: PlanNutricion['estado']) => {
    try {
      await apiMutation(`/api/gymcrm/nutricion/planes/${id}`, 'PATCH', { estado });
      await loadData();
      fireHaptic('success');
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo actualizar estado del plan.'));
      fireHaptic('error');
    }
  };

  const medRows = useMemo(() => {
    return [...mediciones]
      .sort((a, b) => new Date(b.fecha_medicion).getTime() - new Date(a.fecha_medicion).getTime())
      .slice(0, 50);
  }, [mediciones]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[70vh] text-gray-400">Cargando nutrición...</div>;
  }

  if (!isReady) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden">
        <NoiseTexture />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
          <GlassPanel>
            <h1 className="text-3xl font-bold text-white mb-3">Acceso restringido</h1>
            <p className="text-gray-300">Nutrición admin requiere rol `admin` o `nutricionista`.</p>
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
            Nutrición Admin <HeartPulse className="w-7 h-7 text-rose-400" />
          </h1>
          <p className="text-gray-400">Consentimiento, planes personalizados y seguimiento estructurado.</p>
          {error ? <p className="text-red-300 text-sm">{error}</p> : null}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel>
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300" /> Registrar consentimiento
            </h2>
            <div className="space-y-3">
              <select
                value={consentClienteId}
                onChange={(event) => setConsentClienteId(event.target.value)}
                data-testid="nutricion-consent-cliente"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="">Selecciona cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombres} {cliente.apellidos}
                  </option>
                ))}
              </select>
              <textarea
                value={consentText}
                onChange={(event) => setConsentText(event.target.value)}
                rows={4}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <button onClick={createConsent} data-testid="nutricion-create-consent" className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold">
                <span className="inline-flex items-center gap-2 px-4 py-2.5">
                  <Plus className="w-4 h-4" /> Guardar consentimiento
                </span>
              </button>
            </div>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-cyan-300" /> Crear plan nutricional
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={planClienteId}
                  onChange={(event) => setPlanClienteId(event.target.value)}
                  data-testid="nutricion-plan-cliente"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                >
                  <option value="">Selecciona cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombres} {cliente.apellidos}
                    </option>
                  ))}
                </select>
                <select
                  value={planEstado}
                  onChange={(event) => setPlanEstado(event.target.value as 'borrador' | 'activo')}
                  data-testid="nutricion-plan-estado"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                >
                  <option value="borrador">borrador</option>
                  <option value="activo">activo</option>
                </select>
              </div>
              <input
                value={planObjetivo}
                onChange={(event) => setPlanObjetivo(event.target.value)}
                placeholder="Objetivo general"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <textarea
                value={planNotas}
                onChange={(event) => setPlanNotas(event.target.value)}
                rows={3}
                placeholder="Notas y recomendaciones (una por línea)"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <button onClick={createPlan} data-testid="nutricion-create-plan" className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold">
                <span className="inline-flex items-center gap-2 px-4 py-2.5">
                  <Plus className="w-4 h-4" /> Crear plan
                </span>
              </button>
            </div>
          </GlassPanel>
        </div>

        <GlassPanel>
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-300" /> Registrar medición
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <select
              value={medClienteId}
              onChange={(event) => setMedClienteId(event.target.value)}
              data-testid="nutricion-med-cliente"
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
            >
              <option value="">Selecciona cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombres} {cliente.apellidos}
                </option>
              ))}
            </select>
            <select
              value={medPlanId}
              onChange={(event) => setMedPlanId(event.target.value)}
              data-testid="nutricion-med-plan"
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
            >
              <option value="">Sin plan asociado</option>
              {(plansByClient[medClienteId] ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.estado} • {plan.objetivo_general ?? 'Sin objetivo'}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              max={300}
              step="0.1"
              value={medPeso}
              onChange={(event) => setMedPeso(event.target.value === '' ? '' : Number(event.target.value))}
              data-testid="nutricion-med-peso"
              placeholder="Peso (kg)"
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={medAdherencia}
              onChange={(event) => setMedAdherencia(event.target.value === '' ? '' : Number(event.target.value))}
              data-testid="nutricion-med-adherencia"
              placeholder="Adherencia %"
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
            />
            <input
              value={medNotas}
              onChange={(event) => setMedNotas(event.target.value)}
              placeholder="Notas"
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white lg:col-span-2"
            />
            <button onClick={createMedicion} data-testid="nutricion-create-medicion" className="rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold lg:col-span-3">
              <span className="inline-flex items-center gap-2 px-4 py-2.5">
                <Plus className="w-4 h-4" /> Guardar medición
              </span>
            </button>
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="text-white font-semibold mb-4">Planes nutricionales</h2>
          <div className="space-y-3">
            {planes.length === 0 ? <p className="text-sm text-gray-500">Sin planes aún.</p> : null}
            {planes.map((plan) => {
              const cliente = clientesById[plan.cliente_id];
              const hasConsent = Boolean(plan.consentimiento_id ?? activeConsentsByClient[plan.cliente_id]);

              return (
                <div key={plan.id} className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {cliente ? `${cliente.nombres} ${cliente.apellidos}` : `Cliente ${plan.cliente_id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      estado {plan.estado} • consentimiento {hasConsent ? 'ok' : 'faltante'} • actualizado {new Date(plan.updated_at).toLocaleString('es-UY')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {plan.estado !== 'activo' ? (
                      <button
                        onClick={() => patchPlanState(plan.id, 'activo')}
                        data-testid={`nutricion-plan-activar-${plan.id}`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs"
                      >
                        Activar
                      </button>
                    ) : null}
                    {plan.estado !== 'cerrado' ? (
                      <button
                        onClick={() => patchPlanState(plan.id, 'cerrado')}
                        data-testid={`nutricion-plan-cerrar-${plan.id}`}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs"
                      >
                        Cerrar
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="text-white font-semibold mb-4">Mediciones recientes</h2>
          <div className="space-y-3">
            {medRows.length === 0 ? <p className="text-sm text-gray-500">Sin mediciones registradas.</p> : null}
            {medRows.map((med) => {
              const cliente = clientesById[med.cliente_id];
              return (
                <div key={med.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-white text-sm font-medium">
                    {cliente ? `${cliente.nombres} ${cliente.apellidos}` : `Cliente ${med.cliente_id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {med.fecha_medicion} • peso {med.peso_kg ?? '-'} kg • adherencia {med.adherencia_pct ?? '-'}%
                  </p>
                  {med.notas ? <p className="text-xs text-gray-500 mt-1">{med.notas}</p> : null}
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
