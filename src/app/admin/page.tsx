'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Dumbbell, Filter, Plus, Search, UserX, Users, X } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { MemberModal } from '@/components/crm/MemberModal';
import { Member, MemberTable } from '@/components/crm/MemberTable';
import { ActionCard, EmptyState, MetricCard, StatusPill, StickyActionBar } from '@/components/ui/premium';
import { apiGet, apiMutation } from '@/lib/gymcrm/client-api';
import { toUserErrorMessage } from '@/lib/gymcrm/error';

type ClienteResponse = {
  data: Array<{
    id: string;
    nombres: string;
    apellidos: string;
    email: string | null;
    telefono: string | null;
    estado: 'activo' | 'inactivo' | 'suspendido';
    created_at: string;
    updated_at: string;
  }>;
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

const fromCliente = (item: ClienteResponse['data'][number]): Member => ({
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

type ModalMode = 'create' | 'edit' | 'view';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'classes' | 'payments'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse['data'] | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [activeMember, setActiveMember] = useState<Member | null>(null);

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const me = await apiGet<MeResponse>('/api/gymcrm/me');
      setIsReady(me.data.ready && me.data.role?.rol !== 'cliente');

      if (!me.data.ready || me.data.role?.rol === 'cliente') {
        setMembers([]);
        return;
      }

      const [clientes, kpis] = await Promise.all([
        apiGet<ClienteResponse>('/api/gymcrm/clientes?pageSize=200'),
        apiGet<DashboardResponse>('/api/gymcrm/dashboard'),
      ]);

      setMembers((clientes.data ?? []).map(fromCliente));
      setDashboard(kpis.data);
    } catch (err) {
      setError(toUserErrorMessage(err, 'No se pudo cargar admin.'));
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

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
    const payload = toClientePayload(memberData);

    if (!payload.nombres || !payload.apellidos) {
      throw new Error('Nombre y apellido son obligatorios.');
    }

    if (modalMode === 'edit' && activeMember) {
      await apiMutation(`/api/gymcrm/clientes/${activeMember.id}`, 'PATCH', payload);
    } else {
      await apiMutation('/api/gymcrm/clientes', 'POST', payload);
    }

    await loadAdminData();
    setIsModalOpen(false);
  };

  const handleDeactivateMember = async (id: string) => {
    await apiMutation(`/api/gymcrm/clientes/${id}`, 'DELETE');
    await loadAdminData();
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => apiMutation(`/api/gymcrm/clientes/${id}`, 'DELETE')));
    setSelectedIds(new Set());
    await loadAdminData();
  };

  const filteredMembers = useMemo(() => {
    let list = members.filter((member) => {
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesTerm = fullName.includes(term) || member.email.toLowerCase().includes(term);
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

  const tabs = [
    { id: 'members', label: 'Gestión de Clientes', icon: Users },
    { id: 'classes', label: 'Operación de Clases', icon: Dumbbell },
    { id: 'payments', label: 'Cobros y Membresías', icon: CreditCard },
  ] as const;

  return (
    <div className="relative min-h-screen bg-background overflow-hidden selection:bg-indigo-500/30 flex flex-col pb-24">
      <NoiseTexture />

      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[150px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[150px] mix-blend-screen pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 flex flex-col flex-1 w-full">
        <header className="mb-8 flex justify-between items-end gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">Admin Console</h1>
            <p className="text-gray-400 text-lg">Operación diaria del gimnasio por bloques.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link href="/admin/builder" className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30">Builder runtime</Link>
              <Link href="/admin/comunidad" className="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-200 hover:bg-amber-500/30">Comunidad</Link>
              <Link href="/admin/nutricion" className="px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-200 hover:bg-rose-500/30">Nutrición</Link>
            </div>
            {error ? <p className="mt-2 text-red-300 text-sm">{error}</p> : null}
          </div>
          <div className="hidden md:grid grid-cols-3 gap-3 text-xs text-gray-300">
            <MetricCard label="Membresías activas" value={dashboard?.kpis.membresiasActivas ?? 0} />
            <MetricCard label="Ingresos mes" value={`$${(dashboard?.kpis.pagosMes ?? 0).toFixed(0)}`} />
            <MetricCard label="Reservas hoy" value={dashboard?.kpis.reservasConfirmadasHoy ?? 0} />
          </div>
        </header>

        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => {
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

        <div className="flex-1 min-h-0 flex flex-col mb-4">
          <GlassPanel className="flex-1 flex flex-col min-h-0">
            {activeTab === 'members' ? (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o email..."
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
                  description="Gestiona clases base, cupos y horarios operativos en el módulo especializado."
                  action={<Link href="/admin/classes" className="inline-flex rounded-lg bg-indigo-500/20 px-3 py-2 text-indigo-200 hover:bg-indigo-500/30 text-sm">Ir a /admin/classes</Link>}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  title="Cobros y membresías"
                  description="Registra y ajusta pagos desde la sección de clientes o vía API interna /api/gymcrm/pagos."
                />
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
                onClick={handleBulkDeactivate}
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
    </div>
  );
}
