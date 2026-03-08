'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Calendar as CalendarIcon, Clock, MapPin, Users } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import { toUserErrorMessage } from '@/lib/gymcrm/error';

type ClassRecord = {
  id: string;
  nombre: string;
  descripcion: string | null;
  instructor_nombre: string | null;
  nivel: string | null;
};

type ScheduleRecord = {
  id: string;
  clase_base_id: string;
  clase_nombre?: string | null;
  sede_id: string | null;
  inicio: string;
  fin: string;
  cupo_total: number;
  estado: 'programada' | 'cancelada' | 'finalizada';
};

type ReservationRecord = {
  id: string;
  horario_id: string;
  estado: 'confirmada' | 'espera' | 'cancelada' | 'asistio' | 'ausente';
};

type ListResponse<T> = {
  data: T[];
};

const nextDaysRange = () => {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 7);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
};

export default function ClassesPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [classesById, setClassesById] = useState<Record<string, ClassRecord>>({});
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [reservationsBySchedule, setReservationsBySchedule] = useState<Record<string, ReservationRecord>>({});

  const dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const range = nextDaysRange();
      const [classResp, scheduleResp, reservationResp] = await Promise.all([
        apiGet<ListResponse<ClassRecord>>('/api/gymcrm/clases?active=true&pageSize=200'),
        apiGet<ListResponse<ScheduleRecord>>(
          `/api/gymcrm/clases/horarios?start=${encodeURIComponent(range.from)}&end=${encodeURIComponent(range.to)}&pageSize=300`
        ),
        apiGet<ListResponse<ReservationRecord>>('/api/gymcrm/reservas?pageSize=300'),
      ]);

      const classMap: Record<string, ClassRecord> = {};
      for (const cls of classResp.data ?? []) {
        classMap[cls.id] = cls;
      }

      const reservationMap: Record<string, ReservationRecord> = {};
      for (const r of reservationResp.data ?? []) {
        if (r.estado !== 'cancelada') {
          reservationMap[r.horario_id] = r;
        }
      }

      setClassesById(classMap);
      setSchedules((scheduleResp.data ?? []).filter((s) => s.estado === 'programada'));
      setReservationsBySchedule(reservationMap);
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar clases.'));
      setClassesById({});
      setSchedules([]);
      setReservationsBySchedule({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedDaySchedules = useMemo(() => {
    const selectedKey = selectedDate.toDateString();
    return schedules.filter((s) => new Date(s.inicio).toDateString() === selectedKey);
  }, [schedules, selectedDate]);

  const handleReserve = async (horarioId: string, alreadyReserved: boolean) => {
    setIsSaving(horarioId);
    setError(null);

    try {
      if (alreadyReserved) {
        const reservation = reservationsBySchedule[horarioId];
        if (reservation) {
          await apiMutation(`/api/gymcrm/reservas/${reservation.id}`, 'PATCH', { estado: 'cancelada' });
        }
      } else {
        await apiMutation('/api/gymcrm/reservas', 'POST', { horario_id: horarioId });
      }

      await loadData();
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo actualizar la reserva.'));
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden selection:bg-indigo-500/30 font-sans pb-20">
      <NoiseTexture />

      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none translate-y-1/3 -translate-x-1/4" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8 mt-12">
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3 flex items-center gap-3">
            Clases Grupales <CalendarIcon className="w-8 h-8 text-emerald-400" />
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Reserva, cancela y gestiona tu lugar en clases base con cupos y lista de espera.
          </p>
          {error ? <p className="text-red-300 mt-3">{error}</p> : null}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <GlassPanel>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Fechas disponibles</h3>
              <div className="flex overflow-x-auto lg:flex-col gap-2 pb-2 lg:pb-0 hide-scrollbar">
                {dates.map((date, i) => {
                  const isSelected = date.toDateString() === selectedDate.toDateString();
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(date)}
                      className={`flex-shrink-0 flex lg:flex-row flex-col items-center lg:justify-between px-4 py-3 rounded-xl border transition-all duration-300 ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="text-xs uppercase font-medium">{date.toLocaleDateString('es-UY', { weekday: 'short' })}</span>
                      <span className="text-xl font-bold">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </GlassPanel>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-white">
                Horarios para {selectedDate.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <span className="text-sm text-emerald-400 font-medium">{selectedDaySchedules.length} clases</span>
            </div>

            {isLoading ? (
              <GlassPanel className="text-center py-16 text-gray-400">Cargando horarios...</GlassPanel>
            ) : selectedDaySchedules.length === 0 ? (
              <GlassPanel className="text-center py-16">
                <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">No hay clases programadas</h3>
                <p className="text-gray-400">Prueba con otra fecha o crea nuevos horarios desde Admin.</p>
              </GlassPanel>
            ) : (
              <div className="grid gap-4">
                {selectedDaySchedules.map((schedule) => {
                  const classData = classesById[schedule.clase_base_id];
                  const reservation = reservationsBySchedule[schedule.id];
                  const reserved = Boolean(reservation && reservation.estado !== 'cancelada');
                  const waiting = reservation?.estado === 'espera';

                  return (
                    <GlassPanel key={schedule.id} className="group transition-all duration-500 hover:border-emerald-500/30">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-20 text-center shrink-0 border-r border-white/10 pr-4">
                            <span className="block text-lg font-bold text-white mb-1">
                              {new Date(schedule.inicio).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                              {new Date(schedule.fin).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-lg font-bold text-white mb-1">
                              {classData?.nombre ?? schedule.clase_nombre ?? 'Clase programada'}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-400">
                              <span className="flex items-center gap-1.5">
                                <Users className="w-4 h-4" /> Cupo {schedule.cupo_total}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                {new Date(schedule.inicio).toLocaleString('es-UY')}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-4 h-4" /> {classData?.instructor_nombre ?? 'Instructor por definir'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex w-full md:w-auto items-center justify-between md:flex-col md:items-end gap-3 shrink-0">
                          <div
                            className={`text-sm font-medium px-3 py-1 rounded-full border ${
                              waiting
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : reserved
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : 'bg-white/5 border-white/10 text-gray-300'
                            }`}
                          >
                            {waiting ? 'Lista de espera' : reserved ? 'Reservado' : 'Disponible'}
                          </div>

                          <button
                            onClick={() => handleReserve(schedule.id, reserved)}
                            disabled={isSaving === schedule.id}
                            className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-bold transition-all ${
                              reserved
                                ? 'bg-white/5 text-gray-200 hover:bg-white/10 border border-white/10'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                            } disabled:opacity-60`}
                          >
                            {isSaving === schedule.id ? 'Procesando...' : reserved ? 'Cancelar Reserva' : 'Reservar Lugar'}
                          </button>
                        </div>
                      </div>
                    </GlassPanel>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
