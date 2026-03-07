'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Medal, Plus, Trophy, Users } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { useUIExperience } from '@/hooks/useUIExperience';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import { toUserErrorMessage } from '@/lib/gymcrm/error';
import type { UIActionState } from '@/lib/ui/action-state';

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

type Servicio = {
  id: string;
  nombre: string;
  activo: boolean;
};

type Premio = {
  id: string;
  nombre: string;
  tipo: 'descuento_pago' | 'pase_servicio';
  costo_puntos: number;
  monto_descuento: number | null;
  servicio_id: string | null;
  stock_disponible: number | null;
  activa: boolean;
};

type Canje = {
  id: string;
  cliente_id: string;
  premio_id: string;
  estado: 'solicitado' | 'aprobado' | 'rechazado' | 'entregado' | 'anulado';
  puntos: number;
  credito_monto: number | null;
  created_at: string;
};

type RankingEntry = {
  cliente_id: string;
  nombre: string;
  puntos: number;
  posicion: number;
};

type RankingResponse = {
  data: {
    month: string;
    ranking: RankingEntry[];
  };
};

export default function AdminComunidadPage() {
  const { fireHaptic } = useUIExperience();

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [premios, setPremios] = useState<Premio[]>([]);
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  const [puntosClienteId, setPuntosClienteId] = useState('');
  const [puntosValor, setPuntosValor] = useState(25);
  const [puntosMotivo, setPuntosMotivo] = useState('Participación en reto semanal');

  const [premioNombre, setPremioNombre] = useState('');
  const [premioTipo, setPremioTipo] = useState<'descuento_pago' | 'pase_servicio'>('descuento_pago');
  const [premioCosto, setPremioCosto] = useState(100);
  const [premioMonto, setPremioMonto] = useState(100);
  const [premioServicioId, setPremioServicioId] = useState('');
  const [premioStock, setPremioStock] = useState(100);

  const [assignPointsState, setAssignPointsState] = useState<UIActionState>('idle');
  const [createPremioState, setCreatePremioState] = useState<UIActionState>('idle');
  const [canjeActionState, setCanjeActionState] = useState<{
    id: string | null;
    estado: UIActionState;
  }>({ id: null, estado: 'idle' });
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    canjeId: string | null;
    reason: string;
  }>({ open: false, canjeId: null, reason: 'Fuera de vigencia' });

  const clientesById = useMemo(() => {
    const map: Record<string, Cliente> = {};
    for (const cliente of clientes) {
      map[cliente.id] = cliente;
    }
    return map;
  }, [clientes]);

  const premiosById = useMemo(() => {
    const map: Record<string, Premio> = {};
    for (const premio of premios) {
      map[premio.id] = premio;
    }
    return map;
  }, [premios]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const me = await apiGet<MeResponse>('/api/gymcrm/me');
      const canAccess = Boolean(me.data.ready && me.data.role?.rol !== 'cliente');
      setIsReady(canAccess);

      if (!canAccess) {
        setClientes([]);
        setServicios([]);
        setPremios([]);
        setCanjes([]);
        setRanking([]);
        return;
      }

      const [clientesResp, serviciosResp, premiosResp, canjesResp, rankingResp] = await Promise.all([
        apiGet<ListResponse<Cliente>>('/api/gymcrm/clientes?pageSize=200'),
        apiGet<ListResponse<Servicio>>('/api/gymcrm/builder/servicios?active=true&pageSize=100'),
        apiGet<ListResponse<Premio>>('/api/gymcrm/comunidad/premios?pageSize=100'),
        apiGet<ListResponse<Canje>>('/api/gymcrm/comunidad/canjes?pageSize=120'),
        apiGet<RankingResponse>('/api/gymcrm/comunidad/ranking?limit=10'),
      ]);

      setClientes(clientesResp.data ?? []);
      setServicios(serviciosResp.data ?? []);
      setPremios(premiosResp.data ?? []);
      setCanjes(canjesResp.data ?? []);
      setRanking(rankingResp.data.ranking ?? []);

      if (!puntosClienteId && (clientesResp.data?.length ?? 0) > 0) {
        setPuntosClienteId(clientesResp.data[0].id);
      }

      if (!premioServicioId && (serviciosResp.data?.length ?? 0) > 0) {
        setPremioServicioId(serviciosResp.data[0].id);
      }
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar comunidad admin.'));
      setClientes([]);
      setServicios([]);
      setPremios([]);
      setCanjes([]);
      setRanking([]);
    } finally {
      setIsLoading(false);
    }
  }, [premioServicioId, puntosClienteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const assignPoints = async () => {
    setAssignPointsState('loading');
    try {
      if (!puntosClienteId || !puntosMotivo.trim() || !Number.isFinite(puntosValor) || puntosValor === 0) {
        setError('cliente, motivo y puntos (distinto de 0) son obligatorios.');
        fireHaptic('warning');
        setAssignPointsState('error');
        return;
      }

      await apiMutation('/api/gymcrm/comunidad/puntos', 'POST', {
        cliente_id: puntosClienteId,
        puntos: Math.trunc(puntosValor),
        motivo: puntosMotivo.trim(),
        origen_tipo: 'manual',
      });

      await loadData();
      fireHaptic('success');
      setAssignPointsState('success');
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo registrar puntos manuales.'));
      fireHaptic('error');
      setAssignPointsState('error');
    }
  };

  const createPremio = async () => {
    setCreatePremioState('loading');
    try {
      if (!premioNombre.trim() || premioCosto <= 0) {
        setError('Nombre y costo de puntos son obligatorios.');
        fireHaptic('warning');
        setCreatePremioState('error');
        return;
      }

      const payload: Record<string, unknown> = {
        nombre: premioNombre.trim(),
        tipo: premioTipo,
        costo_puntos: Math.trunc(premioCosto),
        stock_total: premioStock > 0 ? Math.trunc(premioStock) : null,
      };

      if (premioTipo === 'descuento_pago') {
        payload.monto_descuento = premioMonto;
      }

      if (premioTipo === 'pase_servicio') {
        if (!premioServicioId) {
          setError('Selecciona servicio para premio tipo pase_servicio.');
          fireHaptic('warning');
          setCreatePremioState('error');
          return;
        }
        payload.servicio_id = premioServicioId;
      }

      await apiMutation('/api/gymcrm/comunidad/premios', 'POST', payload);
      setPremioNombre('');
      await loadData();
      fireHaptic('success');
      setCreatePremioState('success');
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo crear premio.'));
      fireHaptic('error');
      setCreatePremioState('error');
    }
  };

  const patchCanje = async (canjeId: string, estado: Canje['estado'], motivoRechazo?: string) => {
    setCanjeActionState({ id: canjeId, estado: 'loading' });
    try {
      const payload: Record<string, unknown> = { estado };
      if (estado === 'rechazado' && motivoRechazo !== undefined) {
        payload.motivo_rechazo = motivoRechazo;
      }

      await apiMutation(`/api/gymcrm/comunidad/canjes/${canjeId}`, 'PATCH', payload);
      await loadData();
      fireHaptic('success');
      setCanjeActionState({ id: canjeId, estado: 'success' });
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo actualizar canje.'));
      fireHaptic('error');
      setCanjeActionState({ id: canjeId, estado: 'error' });
    }
  };

  const openRejectModal = (canjeId: string) => {
    setRejectModal({
      open: true,
      canjeId,
      reason: 'Fuera de vigencia',
    });
  };

  const closeRejectModal = () => {
    setRejectModal({
      open: false,
      canjeId: null,
      reason: 'Fuera de vigencia',
    });
  };

  const submitRejectCanje = async () => {
    if (!rejectModal.canjeId) return;
    const reason = rejectModal.reason.trim();
    await patchCanje(rejectModal.canjeId, 'rechazado', reason);
    closeRejectModal();
  };

  const canjesRows = useMemo(
    () => [...canjes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50),
    [canjes]
  );

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[70vh] text-gray-400">Cargando comunidad...</div>;
  }

  if (!isReady) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden">
        <NoiseTexture />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
          <GlassPanel>
            <h1 className="text-3xl font-bold text-white mb-3">Acceso restringido</h1>
            <p className="text-gray-300">Comunidad admin requiere rol staff y gym inicializado.</p>
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
            Comunidad Admin <Trophy className="w-7 h-7 text-amber-400" />
          </h1>
          <p className="text-gray-400">Puntaje manual, premios reales y flujo operativo de canjes.</p>
          {error ? <p className="text-red-300 text-sm">{error}</p> : null}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel>
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-300" /> Asignar puntos manuales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={puntosClienteId}
                onChange={(event) => setPuntosClienteId(event.target.value)}
                data-testid="comunidad-points-cliente"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="">Selecciona cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombres} {cliente.apellidos}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={puntosValor}
                onChange={(event) => setPuntosValor(Number(event.target.value))}
                data-testid="comunidad-points-value"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <input
                value={puntosMotivo}
                onChange={(event) => setPuntosMotivo(event.target.value)}
                placeholder="Motivo"
                data-testid="comunidad-points-reason"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white md:col-span-2"
              />
              <button
                onClick={assignPoints}
                disabled={assignPointsState === 'loading'}
                data-testid="comunidad-assign-points"
                className="rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold md:col-span-2"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2.5">
                  <Plus className="w-4 h-4" />
                  {assignPointsState === 'loading' ? 'Registrando...' : 'Registrar movimiento'}
                </span>
              </button>
            </div>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-300" /> Crear premio
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={premioNombre}
                onChange={(event) => setPremioNombre(event.target.value)}
                placeholder="Nombre premio"
                data-testid="comunidad-premio-nombre"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <select
                value={premioTipo}
                onChange={(event) => setPremioTipo(event.target.value as 'descuento_pago' | 'pase_servicio')}
                data-testid="comunidad-premio-tipo"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="descuento_pago">descuento_pago</option>
                <option value="pase_servicio">pase_servicio</option>
              </select>
              <input
                type="number"
                min={1}
                value={premioCosto}
                onChange={(event) => setPremioCosto(Number(event.target.value))}
                placeholder="Costo puntos"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />
              <input
                type="number"
                min={1}
                value={premioStock}
                onChange={(event) => setPremioStock(Number(event.target.value))}
                placeholder="Stock"
                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
              />

              {premioTipo === 'descuento_pago' ? (
                <input
                  type="number"
                  min={1}
                  value={premioMonto}
                  onChange={(event) => setPremioMonto(Number(event.target.value))}
                  placeholder="Monto descuento UYU"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white md:col-span-2"
                />
              ) : (
                <select
                  value={premioServicioId}
                  onChange={(event) => setPremioServicioId(event.target.value)}
                  data-testid="comunidad-premio-servicio"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white md:col-span-2"
                >
                  <option value="">Selecciona servicio</option>
                  {servicios.map((servicio) => (
                    <option key={servicio.id} value={servicio.id}>
                      {servicio.nombre}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={createPremio}
                disabled={createPremioState === 'loading'}
                data-testid="comunidad-create-premio"
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold md:col-span-2"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2.5">
                  <Plus className="w-4 h-4" />
                  {createPremioState === 'loading' ? 'Creando...' : 'Crear premio'}
                </span>
              </button>
            </div>
          </GlassPanel>
        </div>

        <GlassPanel>
          <h2 className="text-white font-semibold mb-4">Canjes en operación (últimos 50)</h2>
          <div className="space-y-3">
            {canjesRows.length === 0 ? (
              <p className="text-sm text-gray-500">Sin canjes aún.</p>
            ) : (
              canjesRows.map((canje) => {
                const cliente = clientesById[canje.cliente_id];
                const premio = premiosById[canje.premio_id];
                const canjeIsBusy = canjeActionState.id === canje.id && canjeActionState.estado === 'loading';

                return (
                  <div key={canje.id} className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-medium">
                        {cliente ? `${cliente.nombres} ${cliente.apellidos}` : `Cliente ${canje.cliente_id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {premio?.nombre ?? 'Premio'} • {canje.puntos} pts • estado {canje.estado}
                        {canje.credito_monto ? ` • crédito UYU ${canje.credito_monto}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canje.estado === 'solicitado' ? (
                        <>
                          <button
                            onClick={() => patchCanje(canje.id, 'aprobado')}
                            disabled={canjeIsBusy}
                            data-testid={`canje-aprobar-${canje.id}`}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed text-xs"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => openRejectModal(canje.id)}
                            disabled={canjeIsBusy}
                            data-testid={`canje-rechazar-${canje.id}`}
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-60 disabled:cursor-not-allowed text-xs"
                          >
                            Rechazar
                          </button>
                        </>
                      ) : null}
                      {canje.estado === 'aprobado' ? (
                        <button
                          onClick={() => patchCanje(canje.id, 'entregado')}
                          disabled={canjeIsBusy}
                          data-testid={`canje-entregar-${canje.id}`}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-60 disabled:cursor-not-allowed text-xs"
                        >
                          Marcar entregado
                        </button>
                      ) : null}
                      {canje.estado !== 'anulado' ? (
                        <button
                          onClick={() => patchCanje(canje.id, 'anulado')}
                          disabled={canjeIsBusy}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-xs"
                        >
                          Anular
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-300" /> Ranking mensual
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ranking.length === 0 ? <p className="text-sm text-gray-500">Sin ranking para el mes actual.</p> : null}
            {ranking.map((entry) => (
              <div key={entry.cliente_id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-white font-medium">#{entry.posicion} {entry.nombre}</p>
                <p className="text-xs text-gray-400">{entry.puntos} puntos</p>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="text-white font-semibold mb-4">Catálogo de premios</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {premios.map((premio) => (
              <div key={premio.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-white font-medium">{premio.nombre}</p>
                <p className="text-xs text-gray-400">
                  {premio.tipo} • {premio.costo_puntos} pts • {premio.activa ? 'activo' : 'inactivo'}
                </p>
                {premio.monto_descuento ? <p className="text-xs text-emerald-300 mt-1">Descuento: UYU {premio.monto_descuento}</p> : null}
                <p className="text-xs text-gray-500 mt-1">Stock: {premio.stock_disponible ?? 'ilimitado'}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      {rejectModal.open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Rechazar canje</h3>
            <p className="mt-1 text-sm text-gray-400">
              Registra un motivo opcional para auditoría y comunicación con el cliente.
            </p>
            <label htmlFor="motivo-rechazo" className="mt-4 block text-xs text-gray-300">
              Motivo de rechazo
            </label>
            <textarea
              id="motivo-rechazo"
              rows={4}
              value={rejectModal.reason}
              onChange={(event) =>
                setRejectModal((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              data-testid="comunidad-rechazo-reason"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-red-300/50"
              placeholder="Ej.: Fuera de vigencia"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeRejectModal}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitRejectCanje}
                data-testid="comunidad-rechazo-submit"
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
