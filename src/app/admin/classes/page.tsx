'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, CheckCircle2, Clock, Edit2, Plus, ScanLine, Settings, Trash2, UserCheck, Users, X } from 'lucide-react';
import { useGymcrmAnalytics } from '@/components/analytics/GymcrmAnalyticsProvider';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { EmptyState, StatusPill } from '@/components/ui/premium';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import { toUserErrorMessage } from '@/lib/gymcrm/error';
import { useUIExperience } from '@/hooks/useUIExperience';

type ClassRecord = {
  id: string;
  nombre: string;
  descripcion: string | null;
  cupo_total: number;
  duracion_min: number;
  nivel: string | null;
  instructor_nombre: string | null;
  activa: boolean;
};

type ScheduleRecord = {
  id: string;
  clase_base_id: string;
  clase_nombre?: string | null;
  inicio: string;
  fin: string;
  estado: 'programada' | 'cancelada' | 'finalizada';
  cupo_total: number;
};

type AttendanceItem = {
  reserva_id: string;
  cliente_id: string;
  cliente_nombre: string;
  estado_reserva: 'confirmada' | 'espera' | 'cancelada' | 'asistio' | 'ausente';
  asistencia_estado: 'pendiente' | 'asistio' | 'ausente';
  checkin: {
    id: string;
    metodo: string;
    created_at: string;
  } | null;
};

type AttendanceResponse = {
  data: {
    horario: {
      id: string;
      inicio: string;
      fin: string;
      estado: string;
      cupo_total: number;
    };
    clase: {
      id: string;
      nombre: string;
      instructor_nombre: string | null;
    } | null;
    asistentes: AttendanceItem[];
  };
};

type ListResponse<T> = { data: T[] };

type EditClassForm = {
  id: string;
  nombre: string;
  descripcion: string;
  cupo_total: number;
  duracion_min: number;
  instructor_nombre: string;
  nivel: string;
};

export default function AdminClassesPage() {
  const { fireHaptic } = useUIExperience();
  const analytics = useGymcrmAnalytics();

  const [activeTab, setActiveTab] = useState<'schedule' | 'types' | 'attendance'>('types');
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newClassName, setNewClassName] = useState('');
  const [newClassDuration, setNewClassDuration] = useState(45);
  const [newClassCupo, setNewClassCupo] = useState(20);

  const [newScheduleClassId, setNewScheduleClassId] = useState('');
  const [newScheduleStart, setNewScheduleStart] = useState('');
  const [newScheduleEnd, setNewScheduleEnd] = useState('');

  const [editingClass, setEditingClass] = useState<EditClassForm | null>(null);
  const [attendanceScheduleId, setAttendanceScheduleId] = useState('');
  const [attendanceRows, setAttendanceRows] = useState<AttendanceItem[]>([]);
  const [attendanceClassName, setAttendanceClassName] = useState('');
  const [attendanceTimeLabel, setAttendanceTimeLabel] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceActionId, setAttendanceActionId] = useState<string | null>(null);
  const [attendanceQrCode, setAttendanceQrCode] = useState('');

  const classMap = useMemo(() => {
    const map: Record<string, ClassRecord> = {};
    for (const item of classes) map[item.id] = item;
    return map;
  }, [classes]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const now = new Date();
      const in14Days = new Date();
      in14Days.setDate(now.getDate() + 14);

      const [classResp, scheduleResp] = await Promise.all([
        apiGet<ListResponse<ClassRecord>>('/api/gymcrm/clases?pageSize=200'),
        apiGet<ListResponse<ScheduleRecord>>(
          `/api/gymcrm/clases/horarios?start=${encodeURIComponent(now.toISOString())}&end=${encodeURIComponent(in14Days.toISOString())}&pageSize=300`
        ),
      ]);

      setClasses(classResp.data ?? []);
      setSchedules(scheduleResp.data ?? []);

      if ((classResp.data?.length ?? 0) > 0) {
        setNewScheduleClassId((current) => current || classResp.data[0].id);
      }
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar gestión de clases.'));
      setClasses([]);
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (schedules.length === 0) {
      setAttendanceScheduleId('');
      setAttendanceRows([]);
      return;
    }

    setAttendanceScheduleId((current) => {
      if (current && schedules.some((schedule) => schedule.id === current)) {
        return current;
      }
      return schedules[0].id;
    });
  }, [schedules]);

  const createClass = async () => {
    try {
      if (!newClassName.trim()) {
        setError('Nombre de clase obligatorio.');
        fireHaptic('warning');
        return;
      }

      await apiMutation('/api/gymcrm/clases', 'POST', {
        nombre: newClassName.trim(),
        cupo_total: newClassCupo,
        duracion_min: newClassDuration,
      });

      analytics.track('clase_base_creada', {
        nombre: newClassName.trim(),
        cupo_total: newClassCupo,
      });
      setNewClassName('');
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo crear la clase.'));
      fireHaptic('error');
    }
  };

  const pauseClass = async (id: string) => {
    try {
      await apiMutation(`/api/gymcrm/clases/${id}`, 'DELETE');
      analytics.track('clase_base_pausada', { clase_id: id });
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo pausar la clase.'));
      fireHaptic('error');
    }
  };

  const openEditClass = (item: ClassRecord) => {
    setEditingClass({
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      cupo_total: item.cupo_total,
      duracion_min: item.duracion_min,
      instructor_nombre: item.instructor_nombre ?? '',
      nivel: item.nivel ?? '',
    });
  };

  const saveEditClass = async () => {
    if (!editingClass) return;

    try {
      await apiMutation(`/api/gymcrm/clases/${editingClass.id}`, 'PATCH', {
        nombre: editingClass.nombre,
        descripcion: editingClass.descripcion || null,
        cupo_total: editingClass.cupo_total,
        duracion_min: editingClass.duracion_min,
        instructor_nombre: editingClass.instructor_nombre || null,
        nivel: editingClass.nivel || null,
      });

      analytics.track('clase_base_editada', {
        clase_id: editingClass.id,
      });
      setEditingClass(null);
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo guardar edición de clase.'));
      fireHaptic('error');
    }
  };

  const createSchedule = async () => {
    try {
      if (!newScheduleClassId || !newScheduleStart || !newScheduleEnd) {
        setError('Clase, inicio y fin son obligatorios para crear horario.');
        fireHaptic('warning');
        return;
      }

      await apiMutation('/api/gymcrm/clases/horarios', 'POST', {
        clase_base_id: newScheduleClassId,
        inicio: newScheduleStart,
        fin: newScheduleEnd,
      });

      analytics.track('horario_clase_creado', {
        clase_base_id: newScheduleClassId,
      });
      setNewScheduleStart('');
      setNewScheduleEnd('');
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo crear horario.'));
      fireHaptic('error');
    }
  };

  const cancelSchedule = async (id: string) => {
    try {
      await apiMutation(`/api/gymcrm/clases/horarios/${id}`, 'DELETE');
      analytics.track('horario_clase_cancelado', { horario_id: id });
      fireHaptic('success');
      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cancelar horario.'));
      fireHaptic('error');
    }
  };

  const loadAttendance = useCallback(
    async (scheduleId: string) => {
      if (!scheduleId) return;

      setAttendanceLoading(true);
      setError(null);

      try {
        const response = await apiGet<AttendanceResponse>(
          `/api/gymcrm/clases/asistencia?horarioId=${encodeURIComponent(scheduleId)}`
        );

        const payload = response.data;
        setAttendanceRows(payload?.asistentes ?? []);
        setAttendanceScheduleId(scheduleId);
        setAttendanceClassName(payload?.clase?.nombre ?? `Horario ${scheduleId.slice(0, 8)}`);
        const start = payload?.horario?.inicio ? new Date(payload.horario.inicio).toLocaleString('es-UY') : '';
        const end = payload?.horario?.fin
          ? new Date(payload.horario.fin).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
          : '';
        setAttendanceTimeLabel(start && end ? `${start} - ${end}` : start || '');
      } catch (err) {
        setError(toUserErrorMessage(err, 'No se pudo cargar asistencia de clase.'));
        setAttendanceRows([]);
      } finally {
        setAttendanceLoading(false);
      }
    },
    []
  );

  const markAttendance = async (reservaId: string, estado: 'asistio' | 'ausente' | 'confirmada') => {
    if (!attendanceScheduleId) return;
    setAttendanceActionId(reservaId);
    setError(null);
    try {
      await apiMutation('/api/gymcrm/clases/asistencia', 'PATCH', {
        horario_id: attendanceScheduleId,
        reserva_id: reservaId,
        estado,
        metodo_checkin: 'manual',
      });
      analytics.track('asistencia_actualizada_staff', {
        horario_id: attendanceScheduleId,
        reserva_id: reservaId,
        estado,
      });
      fireHaptic('success');
      await loadAttendance(attendanceScheduleId);
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo actualizar asistencia.'));
      fireHaptic('error');
    } finally {
      setAttendanceActionId(null);
    }
  };

  const registerCheckinByQr = async () => {
    if (!attendanceScheduleId) {
      setError('Selecciona un horario para registrar check-in por QR.');
      fireHaptic('warning');
      return;
    }

    if (!attendanceQrCode.trim()) {
      setError('Ingresa un código QR válido.');
      fireHaptic('warning');
      return;
    }

    setAttendanceActionId('qr');
    setError(null);

    try {
      await apiMutation('/api/gymcrm/checkins', 'POST', {
        codigo_qr: attendanceQrCode.trim(),
        horario_id: attendanceScheduleId,
        metodo: 'qr',
      });
      analytics.track('checkin_qr_staff', { horario_id: attendanceScheduleId });
      setAttendanceQrCode('');
      fireHaptic('success');
      await loadAttendance(attendanceScheduleId);
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo registrar check-in por QR.'));
      fireHaptic('error');
    } finally {
      setAttendanceActionId(null);
    }
  };

  useEffect(() => {
    if (activeTab !== 'attendance' || !attendanceScheduleId) return;
    void loadAttendance(attendanceScheduleId);
  }, [activeTab, attendanceScheduleId, loadAttendance]);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden selection:bg-rose-500/30 font-sans pb-20">
      <NoiseTexture />

      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none translate-y-1/3 -translate-x-1/4" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8 mt-12">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3 flex items-center gap-3">
              Gestión de Clases <Settings className="w-8 h-8 text-rose-400" />
            </h1>
            <p className="text-gray-400 text-lg max-w-xl">
              Administra tipos de clase y horarios operativos con cupo, reservas y cancelaciones.
            </p>
            {error ? <p className="mt-2 text-red-300">{error}</p> : null}
          </div>
        </header>

        <div className="flex bg-white/5 p-1 rounded-xl w-fit border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            data-testid="admin-classes-tab-schedule"
            className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'schedule' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Calendario
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('types')}
            data-testid="admin-classes-tab-types"
            className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'types' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Tipos de Clase
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            data-testid="admin-classes-tab-attendance"
            className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'attendance' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Asistencia
          </button>
        </div>

        {isLoading ? (
          <GlassPanel className="py-20 text-center text-gray-400">Cargando gestión de clases...</GlassPanel>
        ) : activeTab === 'types' ? (
          <div className="space-y-6">
            <GlassPanel>
              <h2 className="text-white font-semibold mb-4">Nueva clase base</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Nombre (ej: HIIT Extremo)"
                  data-testid="admin-class-name"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                />
                <input
                  type="number"
                  min={15}
                  value={newClassDuration}
                  onChange={(e) => setNewClassDuration(Number(e.target.value))}
                  placeholder="Duración (min)"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                />
                <input
                  type="number"
                  min={1}
                  value={newClassCupo}
                  onChange={(e) => setNewClassCupo(Number(e.target.value))}
                  placeholder="Cupo"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                />
                <button onClick={createClass} data-testid="admin-create-class" className="rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold">
                  <span className="inline-flex items-center gap-2 px-4 py-2.5">
                    <Plus className="w-4 h-4" /> Crear
                  </span>
                </button>
              </div>
            </GlassPanel>

            {classes.length === 0 ? (
              <EmptyState title="Sin clases base" description="Crea tu primera clase para comenzar a programar horarios." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {classes.map((cls) => (
                  <GlassPanel key={cls.id} className="group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-rose-500/10 transition-colors pointer-events-none -translate-y-1/2 translate-x-1/2" />

                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 inline-block">
                        <Activity className="w-6 h-6 text-rose-400" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditClass(cls)}
                          data-testid={`edit-class-${cls.id}`}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => pauseClass(cls.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{cls.nombre}</h3>
                    <div className="space-y-3 mt-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 flex items-center gap-2"><Clock className="w-4 h-4" /> Duración</span>
                        <span className="text-white font-medium">{cls.duracion_min} min</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 flex items-center gap-2"><Users className="w-4 h-4" /> Cupo</span>
                        <span className="text-white font-medium">{cls.cupo_total}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Estado</span>
                        <StatusPill tone={cls.activa ? 'success' : 'danger'}>{cls.activa ? 'Activa' : 'Pausada'}</StatusPill>
                      </div>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'schedule' ? (
          <div className="space-y-6">
            <GlassPanel>
              <h2 className="text-white font-semibold mb-4">Nuevo horario</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={newScheduleClassId}
                  onChange={(e) => setNewScheduleClassId(e.target.value)}
                  data-testid="admin-schedule-class-select"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.nombre}</option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={newScheduleStart ? new Date(newScheduleStart).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setNewScheduleStart(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  data-testid="admin-schedule-start"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                />
                <input
                  type="datetime-local"
                  value={newScheduleEnd ? new Date(newScheduleEnd).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setNewScheduleEnd(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  data-testid="admin-schedule-end"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                />
                <button onClick={createSchedule} data-testid="admin-create-schedule" className="rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold">
                  <span className="inline-flex items-center gap-2 px-4 py-2.5">
                    <Plus className="w-4 h-4" /> Agendar
                  </span>
                </button>
              </div>
            </GlassPanel>

            {schedules.length === 0 ? (
              <EmptyState title="Sin horarios" description="Agenda tus primeras clases para habilitar reservas." />
            ) : (
              <div className="grid gap-4">
                {schedules.map((schedule) => (
                  <GlassPanel key={schedule.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-white font-semibold">{classMap[schedule.clase_base_id]?.nombre ?? schedule.clase_nombre ?? 'Clase programada'}</h3>
                      <p className="text-sm text-gray-400">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        {new Date(schedule.inicio).toLocaleString('es-UY')} - {new Date(schedule.fin).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-gray-200">Cupo {schedule.cupo_total}</span>
                      <StatusPill tone={schedule.estado === 'programada' ? 'success' : 'danger'}>{schedule.estado}</StatusPill>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('attendance');
                          setAttendanceScheduleId(schedule.id);
                          void loadAttendance(schedule.id);
                        }}
                        data-testid={`admin-open-attendance-${schedule.id}`}
                        className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
                      >
                        Asistencia
                      </button>
                      <button
                        onClick={() => cancelSchedule(schedule.id)}
                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      >
                        Cancelar
                      </button>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <GlassPanel>
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-cyan-300" />
                Control de asistencia
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <select
                  value={attendanceScheduleId}
                  onChange={(event) => setAttendanceScheduleId(event.target.value)}
                  data-testid="attendance-schedule-select"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                >
                  <option value="">Selecciona horario</option>
                  {schedules
                    .filter((schedule) => schedule.estado === 'programada')
                    .map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {(classMap[schedule.clase_base_id]?.nombre ?? schedule.clase_nombre ?? 'Clase')} -{' '}
                        {new Date(schedule.inicio).toLocaleString('es-UY')}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (attendanceScheduleId) {
                      void loadAttendance(attendanceScheduleId);
                    }
                  }}
                  data-testid="attendance-load"
                  className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold"
                >
                  <span className="inline-flex items-center gap-2 px-4 py-2.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Cargar asistencia
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <input
                    value={attendanceQrCode}
                    onChange={(event) => setAttendanceQrCode(event.target.value)}
                    placeholder="Escanear/pegar QR"
                    data-testid="attendance-qr-input"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  />
                  <button
                    type="button"
                    onClick={registerCheckinByQr}
                    disabled={attendanceActionId === 'qr'}
                    data-testid="attendance-qr-submit"
                    className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-2 px-4 py-2.5">
                      <ScanLine className="w-4 h-4" />
                      QR
                    </span>
                  </button>
                </div>
              </div>
              {attendanceClassName ? (
                <p className="mt-3 text-sm text-gray-400">
                  {attendanceClassName}
                  {attendanceTimeLabel ? ` • ${attendanceTimeLabel}` : ''}
                </p>
              ) : null}
            </GlassPanel>

            <GlassPanel>
              {attendanceLoading ? (
                <p className="text-gray-400">Cargando asistencia...</p>
              ) : attendanceRows.length === 0 ? (
                <EmptyState
                  title="Sin asistentes para este horario"
                  description="Cuando existan reservas en este horario verás aquí el control asistió/ausente y check-ins."
                />
              ) : (
                <div className="space-y-3">
                  {attendanceRows.map((row) => (
                    <div
                      key={row.reserva_id}
                      className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <p className="text-white font-medium">{row.cliente_nombre}</p>
                        <p className="text-xs text-gray-400">
                          reserva {row.estado_reserva}
                          {row.checkin
                            ? ` • check-in ${row.checkin.metodo} ${new Date(row.checkin.created_at).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`
                            : ' • sin check-in'}
                        </p>
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        <StatusPill tone={row.asistencia_estado === 'asistio' ? 'success' : row.asistencia_estado === 'ausente' ? 'danger' : 'neutral'}>
                          {row.asistencia_estado}
                        </StatusPill>
                        <button
                          type="button"
                          onClick={() => markAttendance(row.reserva_id, 'asistio')}
                          disabled={attendanceActionId === row.reserva_id}
                          data-testid={`attendance-mark-asistio-${row.reserva_id}`}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs disabled:opacity-60"
                        >
                          Asistió
                        </button>
                        <button
                          type="button"
                          onClick={() => markAttendance(row.reserva_id, 'ausente')}
                          disabled={attendanceActionId === row.reserva_id}
                          data-testid={`attendance-mark-ausente-${row.reserva_id}`}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs disabled:opacity-60"
                        >
                          Ausente
                        </button>
                        <button
                          type="button"
                          onClick={() => markAttendance(row.reserva_id, 'confirmada')}
                          disabled={attendanceActionId === row.reserva_id}
                          data-testid={`attendance-mark-confirmada-${row.reserva_id}`}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 hover:bg-white/20 text-xs disabled:opacity-60"
                        >
                          Restablecer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>
          </div>
        )}
      </div>

      {editingClass ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#10141c] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="text-white font-semibold">Editar clase</h3>
              <button onClick={() => setEditingClass(null)} className="p-2 rounded-lg hover:bg-white/10 text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                value={editingClass.nombre}
                onChange={(event) => setEditingClass((prev) => (prev ? { ...prev, nombre: event.target.value } : prev))}
                data-testid="admin-edit-class-name"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                placeholder="Nombre"
              />
              <textarea
                value={editingClass.descripcion}
                onChange={(event) => setEditingClass((prev) => (prev ? { ...prev, descripcion: event.target.value } : prev))}
                rows={3}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                placeholder="Descripción"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="number"
                  value={editingClass.cupo_total}
                  onChange={(event) => setEditingClass((prev) => (prev ? { ...prev, cupo_total: Number(event.target.value) } : prev))}
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Cupo"
                />
                <input
                  type="number"
                  value={editingClass.duracion_min}
                  onChange={(event) => setEditingClass((prev) => (prev ? { ...prev, duracion_min: Number(event.target.value) } : prev))}
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Duración min"
                />
                <input
                  value={editingClass.instructor_nombre}
                  onChange={(event) => setEditingClass((prev) => (prev ? { ...prev, instructor_nombre: event.target.value } : prev))}
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Instructor"
                />
                <input
                  value={editingClass.nivel}
                  onChange={(event) => setEditingClass((prev) => (prev ? { ...prev, nivel: event.target.value } : prev))}
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Nivel"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button onClick={() => setEditingClass(null)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10">
                  Cancelar
                </button>
                <button onClick={saveEditClass} data-testid="admin-save-class-edit" className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400">
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
