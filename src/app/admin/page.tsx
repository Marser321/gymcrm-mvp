'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  CreditCard,
  Dumbbell,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Shield,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { PortalAccessAssistant } from '@/components/gymcrm/PortalAccessAssistant';
import { MemberModal } from '@/components/crm/MemberModal';
import { Member, MemberTable } from '@/components/crm/MemberTable';
import { ActionCard, EmptyState, MetricCard, StatusPill, StickyActionBar } from '@/components/ui/premium';
import { useOpenSession } from '@/hooks/useOpenSession';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import type { PortalAccessIntent } from '@/lib/gymcrm/demo-ui';
import { toUserErrorMessage } from '@/lib/gymcrm/error';

const ADMIN_PORTAL_INTENT: PortalAccessIntent = {
  route: '/admin',
  requiredRoles: ['admin', 'recepcion', 'entrenador', 'nutricionista'],
  recommendedRole: 'admin',
  ctaLabel: 'Entrar como staff demo',
};

type ClienteRecord = {
  id: string;
  nombres: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  estado: 'activo' | 'inactivo' | 'suspendido';
  created_at: string;
  updated_at: string;
};

type ClienteResponse = {
  data: ClienteRecord[];
};

type DashboardResponse = {
  data: {
    kpis: {
      membresiasActivas: number;
      pagosMes: number;
      reservasConfirmadasHoy: number;
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

type PlanRecord = {
  id: string;
  nombre: string;
  precio: number;
  moneda: string;
  duracion_dias: number;
  activo: boolean;
  descripcion: string | null;
};

type MembresiaRecord = {
  id: string;
  cliente_id: string;
  plan_id: string;
  estado: 'activa' | 'vencida' | 'suspendida' | 'cancelada';
  fecha_inicio: string;
  fecha_fin: string;
  created_at: string;
};

type PagoRecord = {
  id: string;
  cliente_id: string;
  membresia_id: string | null;
  monto: number;
  moneda: string;
  estado: 'pendiente' | 'registrado' | 'anulado';
  metodo: string;
  referencia: string | null;
  fecha_pago: string;
};

type StaffRecord = {
  id: string;
  user_id: string;
  email: string | null;
  rol: 'admin' | 'recepcion' | 'entrenador' | 'nutricionista';
  sede_id: string | null;
  activo: boolean;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  notas: string | null;
  created_at: string;
};

type ListResponse<T> = {
  data: T[];
  count?: number;
};

const fromCliente = (item: ClienteRecord): Member => ({
  id: item.id,
  first_name: item.nombres,
  last_name: item.apellidos,
  email: item.email ?? '',
  phone: item.telefono,
  status: item.estado === 'activo' ? 'active' : item.estado === 'inactivo' ? 'inactive' : 'suspended',
  created_at: item.created_at,
  updated_at: item.updated_at,
});

const toClientePayload = (memberData: Partial<Member>) => ({
  nombres: memberData.first_name?.trim(),
  apellidos: memberData.last_name?.trim(),
  email: memberData.email?.trim() || null,
  telefono: memberData.phone?.trim() || null,
  estado:
    memberData.status === 'active'
      ? 'activo'
      : memberData.status === 'inactive'
        ? 'inactivo'
        : 'suspendido',
});

const asDateInput = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

type ModalMode = 'create' | 'edit' | 'view';
type AdminTab = 'members' | 'payments' | 'classes' | 'staff';

type MutationState = 'idle' | 'loading' | 'success' | 'error';

export default function AdminPage() {
  const { role: openRole, ready: sessionReady } = useOpenSession();
  const [activeTab, setActiveTab] = useState<AdminTab>('members');

  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [membresias, setMembresias] = useState<MembresiaRecord[]>([]);
  const [pagos, setPagos] = useState<PagoRecord[]>([]);
  const [staffRows, setStaffRows] = useState<StaffRecord[]>([]);

  const [planNombre, setPlanNombre] = useState('');
  const [planPrecio, setPlanPrecio] = useState(1500);
  const [planDuracion, setPlanDuracion] = useState(30);

  const [membresiaClienteId, setMembresiaClienteId] = useState('');
  const [membresiaPlanId, setMembresiaPlanId] = useState('');
  const [membresiaInicio, setMembresiaInicio] = useState(asDateInput(new Date()));

  const [pagoClienteId, setPagoClienteId] = useState('');
  const [pagoMembresiaId, setPagoMembresiaId] = useState('');
  const [pagoMonto, setPagoMonto] = useState(1500);
  const [pagoMetodo, setPagoMetodo] = useState('manual');

  const [staffRol, setStaffRol] = useState<'admin' | 'recepcion' | 'entrenador' | 'nutricionista'>('entrenador');
  const [staffNombres, setStaffNombres] = useState('');
  const [staffApellidos, setStaffApellidos] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffTelefono, setStaffTelefono] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse['data'] | null>(null);
  const [mutationState, setMutationState] = useState<MutationState>('idle');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [activeMember, setActiveMember] = useState<Member | null>(null);

  const [isResettingDemo, setIsResettingDemo] = useState(false);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: 'UYU',
        maximumFractionDigits: 0,
      }),
    []
  );

  const roleCanManageStaff = openRole === 'admin';

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const me = await apiGet<MeResponse>('/api/gymcrm/me');
      const canAccess = Boolean(me.data.ready && openRole !== 'cliente');
      setIsReady(canAccess);

      if (!canAccess) {
        setMembers([]);
        setPlans([]);
        setMembresias([]);
        setPagos([]);
        setStaffRows([]);
        return;
      }

      const requests: Promise<unknown>[] = [
        apiGet<ClienteResponse>('/api/gymcrm/clientes?pageSize=200'),
        apiGet<DashboardResponse>('/api/gymcrm/dashboard'),
        apiGet<ListResponse<PlanRecord>>('/api/gymcrm/planes?pageSize=120'),
        apiGet<ListResponse<MembresiaRecord>>('/api/gymcrm/membresias?pageSize=150'),
        apiGet<ListResponse<PagoRecord>>('/api/gymcrm/pagos?pageSize=150'),
      ];

      if (roleCanManageStaff) {
        requests.push(apiGet<ListResponse<StaffRecord>>('/api/gymcrm/staff?pageSize=120'));
      }

      const responses = await Promise.all(requests);
      const clientes = responses[0] as ClienteResponse;
      const kpis = responses[1] as DashboardResponse;
      const planesResp = responses[2] as ListResponse<PlanRecord>;
      const membresiasResp = responses[3] as ListResponse<MembresiaRecord>;
      const pagosResp = responses[4] as ListResponse<PagoRecord>;
      const staffResp = roleCanManageStaff ? (responses[5] as ListResponse<StaffRecord>) : { data: [] };

      const nextMembers = (clientes.data ?? []).map(fromCliente);
      setMembers(nextMembers);
      setDashboard(kpis.data);
      setPlans(planesResp.data ?? []);
      setMembresias(membresiasResp.data ?? []);
      setPagos(pagosResp.data ?? []);
      setStaffRows(staffResp.data ?? []);

      const firstClient = nextMembers[0]?.id ?? '';
      const firstPlan = (planesResp.data ?? [])[0]?.id ?? '';

      setMembresiaClienteId((current) => current || firstClient);
      setPagoClienteId((current) => current || firstClient);
      setMembresiaPlanId((current) => current || firstPlan);
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar admin.'));
    } finally {
      setIsLoading(false);
    }
  }, [openRole, roleCanManageStaff]);

  useEffect(() => {
    if (!sessionReady) return;
    void loadAdminData();
  }, [loadAdminData, sessionReady, openRole]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (members.some((member) => member.id === id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [members]);

  const setMutationFeedback = (status: MutationState, message?: string) => {
    setMutationState(status);
    if (message) {
      if (status === 'error') setError(message);
      if (status === 'success') setFeedback(message);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setActiveMember(null);
    setIsModalOpen(true);
  };

  const openEditModal = (member: Member) => {
    setModalMode('edit');
    setActiveMember(member);
    setIsModalOpen(true);
  };

  const openViewModal = (member: Member) => {
    setModalMode('view');
    setActiveMember(member);
    setIsModalOpen(true);
  };

  const handleSaveMember = async (memberData: Partial<Member>) => {
    setError(null);
    setFeedback(null);

    const payload = toClientePayload(memberData);
    if (!payload.nombres || !payload.apellidos) {
      throw new Error('Nombre y apellido son obligatorios.');
    }

    setMutationState('loading');

    try {
      if (modalMode === 'edit' && activeMember) {
        await apiMutation(`/api/gymcrm/clientes/${activeMember.id}`, 'PATCH', payload);
      } else {
        await apiMutation('/api/gymcrm/clientes', 'POST', payload);
      }

      await loadAdminData();
      setMutationFeedback('success', 'Cliente guardado correctamente.');
      setIsModalOpen(false);
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo guardar cliente.'));
      throw err;
    }
  };

  const handleDeactivateMember = async (id: string) => {
    setError(null);
    setFeedback(null);
    setMutationState('loading');

    try {
      await apiMutation(`/api/gymcrm/clientes/${id}`, 'DELETE');
      await loadAdminData();
      setMutationFeedback('success', 'Cliente desactivado.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo desactivar cliente.'));
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.size === 0) return;
    setError(null);
    setFeedback(null);
    setMutationState('loading');

    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => apiMutation(`/api/gymcrm/clientes/${id}`, 'DELETE')));
      setSelectedIds(new Set());
      await loadAdminData();
      setMutationFeedback('success', 'Clientes seleccionados desactivados.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo desactivar clientes seleccionados.'));
    }
  };

  const createPlan = async () => {
    setError(null);
    setFeedback(null);

    if (!planNombre.trim()) {
      setMutationFeedback('error', 'El nombre del plan es obligatorio.');
      return;
    }

    setMutationState('loading');

    try {
      await apiMutation('/api/gymcrm/planes', 'POST', {
        nombre: planNombre.trim(),
        precio: planPrecio,
        moneda: 'UYU',
        duracion_dias: planDuracion,
        incluye_reservas: true,
      });

      setPlanNombre('');
      await loadAdminData();
      setMutationFeedback('success', 'Plan creado correctamente.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo crear plan.'));
    }
  };

  const pausePlan = async (planId: string) => {
    setError(null);
    setFeedback(null);
    setMutationState('loading');

    try {
      await apiMutation(`/api/gymcrm/planes/${planId}`, 'DELETE');
      await loadAdminData();
      setMutationFeedback('success', 'Plan pausado.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo pausar plan.'));
    }
  };

  const createMembresia = async () => {
    setError(null);
    setFeedback(null);

    if (!membresiaClienteId || !membresiaPlanId || !membresiaInicio) {
      setMutationFeedback('error', 'Selecciona cliente, plan y fecha de inicio.');
      return;
    }

    const selectedPlan = plans.find((item) => item.id === membresiaPlanId);
    if (!selectedPlan) {
      setMutationFeedback('error', 'Plan inválido para membresía.');
      return;
    }

    const startDate = new Date(`${membresiaInicio}T00:00:00`);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + selectedPlan.duracion_dias - 1);

    setMutationState('loading');

    try {
      await apiMutation('/api/gymcrm/membresias', 'POST', {
        cliente_id: membresiaClienteId,
        plan_id: membresiaPlanId,
        fecha_inicio: asDateInput(startDate),
        fecha_fin: asDateInput(endDate),
        estado: 'activa',
      });

      await loadAdminData();
      setMutationFeedback('success', 'Membresía creada correctamente.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo crear membresía.'));
    }
  };

  const updateMembresiaEstado = async (membresiaId: string, estado: 'suspendida' | 'cancelada' | 'activa') => {
    setError(null);
    setFeedback(null);
    setMutationState('loading');

    try {
      await apiMutation(`/api/gymcrm/membresias/${membresiaId}`, 'PATCH', { estado });
      await loadAdminData();
      setMutationFeedback('success', `Membresía actualizada a ${estado}.`);
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo actualizar membresía.'));
    }
  };

  const createPago = async () => {
    setError(null);
    setFeedback(null);

    if (!pagoClienteId) {
      setMutationFeedback('error', 'Selecciona cliente para registrar pago.');
      return;
    }

    if (!Number.isFinite(pagoMonto) || pagoMonto < 0) {
      setMutationFeedback('error', 'Monto de pago inválido.');
      return;
    }

    setMutationState('loading');

    try {
      await apiMutation('/api/gymcrm/pagos', 'POST', {
        cliente_id: pagoClienteId,
        membresia_id: pagoMembresiaId || null,
        monto: pagoMonto,
        moneda: 'UYU',
        metodo: pagoMetodo,
        estado: 'registrado',
      });

      await loadAdminData();
      setMutationFeedback('success', 'Pago registrado correctamente.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo registrar pago.'));
    }
  };

  const anularPago = async (pagoId: string) => {
    setError(null);
    setFeedback(null);
    setMutationState('loading');

    try {
      await apiMutation(`/api/gymcrm/pagos/${pagoId}`, 'DELETE');
      await loadAdminData();
      setMutationFeedback('success', 'Pago anulado correctamente.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo anular pago.'));
    }
  };

  const createStaff = async () => {
    setError(null);
    setFeedback(null);

    if (!roleCanManageStaff) {
      setMutationFeedback('error', 'Solo admin puede crear staff.');
      return;
    }

    if (!staffNombres.trim() || !staffApellidos.trim()) {
      setMutationFeedback('error', 'Nombres y apellidos son obligatorios para staff.');
      return;
    }

    setMutationState('loading');

    try {
      const response = await apiMutation<{ data?: StaffRecord }>('/api/gymcrm/staff', 'POST', {
        rol: staffRol,
        nombres: staffNombres.trim(),
        apellidos: staffApellidos.trim(),
        email: staffEmail.trim() || null,
        telefono: staffTelefono.trim() || null,
      });

      const createdStaff = response.data;
      if (createdStaff?.id) {
        setStaffRows((prev) => [createdStaff, ...prev.filter((row) => row.id !== createdStaff.id)]);
      }

      setStaffNombres('');
      setStaffApellidos('');
      setStaffEmail('');
      setStaffTelefono('');
      await loadAdminData();
      setMutationFeedback('success', 'Staff creado correctamente.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo crear staff.'));
    }
  };

  const disableStaff = async (staffId: string) => {
    setError(null);
    setFeedback(null);
    setMutationState('loading');

    try {
      await apiMutation(`/api/gymcrm/staff/${staffId}`, 'DELETE');
      setStaffRows((prev) => prev.map((row) => (row.id === staffId ? { ...row, activo: false } : row)));
      await loadAdminData();
      setMutationFeedback('success', 'Staff desactivado correctamente.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo desactivar staff.'));
    }
  };

  const reactivateStaff = async (staffId: string) => {
    setError(null);
    setFeedback(null);
    setMutationState('loading');

    try {
      await apiMutation(`/api/gymcrm/staff/${staffId}`, 'PATCH', { activo: true });
      setStaffRows((prev) => prev.map((row) => (row.id === staffId ? { ...row, activo: true } : row)));
      await loadAdminData();
      setMutationFeedback('success', 'Staff reactivado correctamente.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo reactivar staff.'));
    }
  };

  const resetDemoData = async () => {
    if (!roleCanManageStaff) return;
    setError(null);
    setFeedback(null);
    setIsResettingDemo(true);

    try {
      await apiMutation('/api/gymcrm/demo/reset', 'POST', { confirm: true });
      await loadAdminData();
      setMutationFeedback('success', 'Dataset demo reiniciado y curado.');
    } catch (err) {
      setMutationFeedback('error', toUserErrorMessage(err, 'No se pudo reiniciar dataset demo.'));
    } finally {
      setIsResettingDemo(false);
    }
  };

  const filteredMembers = useMemo(() => {
    let list = members.filter((member) => {
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesTerm =
        fullName.includes(term) ||
        member.email.toLowerCase().includes(term) ||
        (member.phone ?? '').toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' ? true : member.status === statusFilter;
      return matchesTerm && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'es');
      }

      const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bDate - aDate;
    });

    return list;
  }, [members, searchTerm, statusFilter, sortBy]);

  const clienteById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const member of members) {
      map.set(member.id, member);
    }
    return map;
  }, [members]);

  const planById = useMemo(() => {
    const map = new Map<string, PlanRecord>();
    for (const plan of plans) {
      map.set(plan.id, plan);
    }
    return map;
  }, [plans]);

  const staffVisibleTabs = useMemo(() => {
    const base: Array<{ id: AdminTab; label: string; icon: typeof Users }> = [
      { id: 'members', label: 'Clientes', icon: Users },
      { id: 'payments', label: 'Operación diaria', icon: CreditCard },
      { id: 'classes', label: 'Clases', icon: Dumbbell },
    ];

    if (roleCanManageStaff) {
      base.push({ id: 'staff', label: 'Staff', icon: Briefcase });
    }

    return base;
  }, [roleCanManageStaff]);

  const toggleMemberSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(filteredMembers.map((member) => member.id)));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin" />
          <div className="absolute inset-2 rounded-full border-r-2 border-cyan-500 animate-spin direction-reverse" />
        </div>
        <p className="mt-4 text-gray-400 font-medium tracking-widest text-sm uppercase">Cargando Admin</p>
      </div>
    );
  }

  if (openRole === 'cliente') {
    return (
      <PortalAccessAssistant
        intent={ADMIN_PORTAL_INTENT}
        currentRole={openRole}
        title="Consola admin en modo demo"
        description="Este portal requiere rol staff. Cambia de rol y recorre operación, clases, comunidad y nutrición."
        error={error}
      />
    );
  }

  if (!isReady) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden selection:bg-indigo-500/30 flex flex-col">
        <NoiseTexture />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20">
          <GlassPanel>
            <h1 className="text-3xl font-bold text-white mb-3">Acceso restringido</h1>
            <p className="text-gray-300">
              Esta sección requiere un rol staff (`admin`, `recepcion` o `entrenador`) y que el gym esté inicializado.
            </p>
            {error ? <p className="mt-4 text-red-300">{error}</p> : null}
          </GlassPanel>
        </div>
      </div>
    );
  }

  const recommendedFlow = 'Dashboard → Clientes → Clases → Cobros → Portal Cliente';

  return (
    <div className="relative min-h-screen bg-background overflow-hidden selection:bg-indigo-500/30 flex flex-col pb-24">
      <NoiseTexture />

      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[150px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[150px] mix-blend-screen pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 flex flex-col flex-1 w-full">
        <header className="mb-8 flex justify-between items-end gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">Admin Console</h1>
            <p className="text-gray-400 text-lg">Operación diaria cerrada de punta a punta.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <StatusPill tone="info">Ruta recomendada: {recommendedFlow}</StatusPill>
              <Link href="/admin/builder" className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30">Builder</Link>
              <Link href="/admin/comunidad" className="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-200 hover:bg-amber-500/30">Comunidad</Link>
              <Link href="/admin/nutricion" className="px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-200 hover:bg-rose-500/30">Nutrición</Link>
            </div>
            {error ? <p className="mt-2 text-red-300 text-sm">{error}</p> : null}
            {feedback ? <p className="mt-2 text-emerald-300 text-sm">{feedback}</p> : null}
          </div>
          <div className="hidden md:grid grid-cols-3 gap-3 text-xs text-gray-300">
            <MetricCard label="Membresías activas" value={dashboard?.kpis.membresiasActivas ?? 0} />
            <MetricCard label="Ingresos mes" value={currency.format(dashboard?.kpis.pagosMes ?? 0)} />
            <MetricCard label="Reservas hoy" value={dashboard?.kpis.reservasConfirmadasHoy ?? 0} />
          </div>
        </header>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {staffVisibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`admin-tab-${tab.id}`}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white/10 text-white border border-white/20 shadow-lg shadow-black/50'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {roleCanManageStaff ? (
            <button
              type="button"
              data-testid="admin-demo-reset"
              onClick={() => {
                void resetDemoData();
              }}
              disabled={isResettingDemo}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-60"
            >
              <RotateCcw className="w-4 h-4" />
              {isResettingDemo ? 'Reseteando...' : 'Reset demo'}
            </button>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 flex flex-col mb-4">
          <GlassPanel className="flex-1 flex flex-col min-h-0">
            {activeTab === 'members' ? (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, email o teléfono..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="admin-member-search"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      data-testid="admin-filter-toggle"
                      onClick={() => setShowFilters((value) => !value)}
                      className="p-2.5 rounded-xl border border-white/10 bg-black/20 text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      {showFilters ? <X className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={openCreateModal}
                      data-testid="admin-new-member"
                      className="flex-1 flex sm:flex-none items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Nuevo Cliente
                    </button>
                  </div>
                </div>

                {showFilters ? (
                  <div className="mb-5 rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs uppercase tracking-wider text-gray-400">Filtro</label>
                        <select
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive' | 'suspended')}
                          className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                        >
                          <option value="all">Todos</option>
                          <option value="active">Activos</option>
                          <option value="inactive">Inactivos</option>
                          <option value="suspended">Suspendidos</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-gray-400">Orden</label>
                        <select
                          value={sortBy}
                          onChange={(event) => setSortBy(event.target.value as 'recent' | 'name')}
                          className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                        >
                          <option value="recent">Recientes</option>
                          <option value="name">Nombre A-Z</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : null}

                <MemberTable
                  members={filteredMembers}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleMemberSelection}
                  onToggleSelectAll={toggleSelectAll}
                  onEdit={openEditModal}
                  onView={openViewModal}
                  onDelete={handleDeactivateMember}
                />

                <div className="mt-4 pt-4 border-t border-white/10 text-sm text-gray-400 flex items-center justify-between">
                  <span>Mostrando {filteredMembers.length} de {members.length} clientes.</span>
                  <StatusPill tone="info">Selección: {selectedIds.size}</StatusPill>
                </div>
              </>
            ) : activeTab === 'classes' ? (
              <div className="flex-1 flex items-center justify-center">
                <ActionCard
                  title="Operación de clases"
                  description="Gestiona clases base, cupos, horarios y asistencia QR/manual en el módulo especializado."
                  action={<Link href="/admin/classes" className="inline-flex rounded-lg bg-indigo-500/20 px-3 py-2 text-indigo-200 hover:bg-indigo-500/30 text-sm">Ir a /admin/classes</Link>}
                />
              </div>
            ) : activeTab === 'staff' ? (
              <div className="space-y-6">
                <GlassPanel>
                  <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-300" />
                    Alta de staff híbrido
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <select
                      value={staffRol}
                      onChange={(event) => setStaffRol(event.target.value as typeof staffRol)}
                      data-testid="admin-staff-role"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="recepcion">Recepción</option>
                      <option value="entrenador">Entrenador</option>
                      <option value="nutricionista">Nutricionista</option>
                    </select>
                    <input
                      value={staffNombres}
                      onChange={(event) => setStaffNombres(event.target.value)}
                      placeholder="Nombres"
                      data-testid="admin-staff-nombres"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    />
                    <input
                      value={staffApellidos}
                      onChange={(event) => setStaffApellidos(event.target.value)}
                      placeholder="Apellidos"
                      data-testid="admin-staff-apellidos"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    />
                    <input
                      type="email"
                      value={staffEmail}
                      onChange={(event) => setStaffEmail(event.target.value)}
                      placeholder="Email (opcional)"
                      data-testid="admin-staff-email"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    />
                    <input
                      value={staffTelefono}
                      onChange={(event) => setStaffTelefono(event.target.value)}
                      placeholder="Teléfono"
                      data-testid="admin-staff-telefono"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void createStaff();
                      }}
                      data-testid="admin-create-staff"
                      className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold"
                    >
                      Crear
                    </button>
                  </div>
                </GlassPanel>

                {staffRows.length === 0 ? (
                  <EmptyState
                    title="Sin staff registrado"
                    description="Crea administradores, recepción y profesores para operar el gimnasio."
                  />
                ) : (
                  <div className="space-y-3">
                    {staffRows.map((row) => (
                      <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-white font-semibold">{row.nombres} {row.apellidos}</p>
                          <p className="text-xs text-gray-400">{row.email ?? row.user_id} • {row.rol}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill tone={row.activo ? 'success' : 'neutral'}>{row.activo ? 'Activo' : 'Inactivo'}</StatusPill>
                          {row.activo ? (
                            <button
                              type="button"
                              onClick={() => {
                                void disableStaff(row.id);
                              }}
                              data-testid={`admin-disable-staff-${row.id}`}
                              className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30"
                            >
                              Desactivar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                void reactivateStaff(row.id);
                              }}
                              data-testid={`admin-reactivate-staff-${row.id}`}
                              className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30"
                            >
                              Reactivar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GlassPanel>
                    <h2 className="text-white font-semibold mb-4">Planes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        value={planNombre}
                        onChange={(event) => setPlanNombre(event.target.value)}
                        placeholder="Nombre plan"
                        data-testid="admin-plan-name"
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white md:col-span-2"
                      />
                      <input
                        type="number"
                        value={planPrecio}
                        onChange={(event) => setPlanPrecio(Number(event.target.value))}
                        placeholder="Precio"
                        data-testid="admin-plan-price"
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      />
                      <input
                        type="number"
                        value={planDuracion}
                        onChange={(event) => setPlanDuracion(Number(event.target.value))}
                        placeholder="Duración días"
                        data-testid="admin-plan-duration"
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void createPlan();
                      }}
                      data-testid="admin-create-plan"
                      className="mt-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-4 py-2.5"
                    >
                      Crear plan
                    </button>

                    <div className="mt-4 space-y-2 max-h-56 overflow-auto pr-1">
                      {plans.length === 0 ? <p className="text-sm text-gray-500">Sin planes aún.</p> : null}
                      {plans.map((plan) => (
                        <div key={plan.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-white font-medium">{plan.nombre}</p>
                            <p className="text-xs text-gray-400">{currency.format(plan.precio)} • {plan.duracion_dias} días</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusPill tone={plan.activo ? 'success' : 'neutral'}>{plan.activo ? 'Activo' : 'Pausado'}</StatusPill>
                            {plan.activo ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void pausePlan(plan.id);
                                }}
                                data-testid={`admin-pause-plan-${plan.id}`}
                                className="text-xs rounded-lg px-3 py-1.5 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                              >
                                Pausar
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassPanel>

                  <GlassPanel>
                    <h2 className="text-white font-semibold mb-4">Membresías</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        value={membresiaClienteId}
                        onChange={(event) => setMembresiaClienteId(event.target.value)}
                        data-testid="admin-membership-client"
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      >
                        <option value="">Cliente</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>
                        ))}
                      </select>
                      <select
                        value={membresiaPlanId}
                        onChange={(event) => setMembresiaPlanId(event.target.value)}
                        data-testid="admin-membership-plan"
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      >
                        <option value="">Plan</option>
                        {plans.filter((plan) => plan.activo).map((plan) => (
                          <option key={plan.id} value={plan.id}>{plan.nombre}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={membresiaInicio}
                        onChange={(event) => setMembresiaInicio(event.target.value)}
                        data-testid="admin-membership-start"
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void createMembresia();
                      }}
                      data-testid="admin-create-membership"
                      className="mt-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-4 py-2.5"
                    >
                      Asignar membresía
                    </button>

                    <div className="mt-4 space-y-2 max-h-56 overflow-auto pr-1">
                      {membresias.length === 0 ? <p className="text-sm text-gray-500">Sin membresías registradas.</p> : null}
                      {membresias.slice(0, 24).map((membresia) => {
                        const client = clienteById.get(membresia.cliente_id);
                        const plan = planById.get(membresia.plan_id);
                        return (
                          <div key={membresia.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div>
                              <p className="text-sm text-white font-medium">{client ? `${client.first_name} ${client.last_name}` : 'Cliente'}</p>
                              <p className="text-xs text-gray-400">{plan?.nombre ?? 'Plan'} • {membresia.fecha_inicio} → {membresia.fecha_fin}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusPill tone={membresia.estado === 'activa' ? 'success' : membresia.estado === 'cancelada' ? 'danger' : 'neutral'}>
                                {membresia.estado}
                              </StatusPill>
                              <button
                                type="button"
                                onClick={() => {
                                  void updateMembresiaEstado(membresia.id, 'suspendida');
                                }}
                                data-testid={`admin-membership-suspend-${membresia.id}`}
                                className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/30"
                              >
                                Suspender
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void updateMembresiaEstado(membresia.id, 'cancelada');
                                }}
                                data-testid={`admin-membership-cancel-${membresia.id}`}
                                className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs text-red-200 hover:bg-red-500/30"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassPanel>
                </div>

                <GlassPanel>
                  <h2 className="text-white font-semibold mb-4">Pagos manuales</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select
                      value={pagoClienteId}
                      onChange={(event) => setPagoClienteId(event.target.value)}
                      data-testid="admin-payment-client"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    >
                      <option value="">Cliente</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>
                      ))}
                    </select>
                    <select
                      value={pagoMembresiaId}
                      onChange={(event) => setPagoMembresiaId(event.target.value)}
                      data-testid="admin-payment-membership"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    >
                      <option value="">Membresía (opcional)</option>
                      {membresias
                        .filter((membresia) => !pagoClienteId || membresia.cliente_id === pagoClienteId)
                        .map((membresia) => (
                          <option key={membresia.id} value={membresia.id}>
                            {planById.get(membresia.plan_id)?.nombre ?? 'Plan'} • {membresia.estado}
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      value={pagoMonto}
                      onChange={(event) => setPagoMonto(Number(event.target.value))}
                      data-testid="admin-payment-amount"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      placeholder="Monto"
                    />
                    <input
                      value={pagoMetodo}
                      onChange={(event) => setPagoMetodo(event.target.value)}
                      data-testid="admin-payment-method"
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      placeholder="Método"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void createPago();
                    }}
                    data-testid="admin-create-payment"
                    className="mt-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-4 py-2.5"
                  >
                    Registrar pago
                  </button>

                  <div className="mt-4 space-y-2 max-h-60 overflow-auto pr-1">
                    {pagos.length === 0 ? <p className="text-sm text-gray-500">Sin pagos registrados.</p> : null}
                    {pagos.slice(0, 32).map((pago) => {
                      const client = clienteById.get(pago.cliente_id);
                      return (
                        <div key={pago.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <p className="text-sm text-white font-medium">{client ? `${client.first_name} ${client.last_name}` : 'Cliente'}</p>
                            <p className="text-xs text-gray-400">{currency.format(pago.monto)} • {pago.metodo} • {new Date(pago.fecha_pago).toLocaleDateString('es-UY')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusPill tone={pago.estado === 'registrado' ? 'success' : pago.estado === 'anulado' ? 'danger' : 'neutral'}>
                              {pago.estado}
                            </StatusPill>
                            {pago.estado !== 'anulado' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void anularPago(pago.id);
                                }}
                                data-testid={`admin-payment-cancel-${pago.id}`}
                                className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs text-red-200 hover:bg-red-500/30"
                              >
                                Anular
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassPanel>
              </div>
            )}
          </GlassPanel>
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <StickyActionBar>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-200">{selectedIds.size} clientes seleccionados</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                Limpiar
              </button>
              <button
                type="button"
                data-testid="admin-bulk-deactivate"
                onClick={() => {
                  void handleBulkDeactivate();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30"
              >
                <UserX className="w-4 h-4" />
                Desactivar seleccionados
              </button>
            </div>
          </div>
        </StickyActionBar>
      ) : null}

      <MemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMember}
        member={activeMember}
        readOnly={modalMode === 'view'}
      />

      {mutationState === 'loading' ? (
        <div className="fixed bottom-4 right-4 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-gray-200 z-50">
          Procesando cambios...
        </div>
      ) : null}
    </div>
  );
}
