'use client';

import { Edit2, Eye, MoreVertical, UserX } from 'lucide-react';

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

interface MemberTableProps {
  members: Member[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onEdit: (member: Member) => void;
  onDelete: (id: string) => void;
  onView: (member: Member) => void;
}

export function MemberTable({
  members,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onView,
}: MemberTableProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const d = new Date(dateStr);
    return new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(
      Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  const allSelected = members.length > 0 && members.every((member) => selectedIds.has(member.id));

  const closeDetailsMenu = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return;
    const details = target.closest('details') as HTMLDetailsElement | null;
    if (details) details.open = false;
  };

  return (
    <div className="flex-1 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 text-gray-400 text-sm uppercase tracking-wider">
            <th className="pb-3 px-2 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
                aria-label="Seleccionar todos"
                data-testid="members-select-all"
                className="h-4 w-4 rounded border-white/20 bg-black/20"
              />
            </th>
            <th className="pb-3 px-4 font-medium">Usuario</th>
            <th className="pb-3 px-4 font-medium">Estado</th>
            <th className="pb-3 px-4 font-medium hidden md:table-cell">Última Actividad</th>
            <th className="pb-3 px-4 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-8 text-gray-500">
                No se encontraron miembros.
              </td>
            </tr>
          ) : (
            members.map((user) => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                <td className="py-4 px-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={(event) => onToggleSelect(user.id, event.target.checked)}
                    aria-label={`Seleccionar ${user.first_name} ${user.last_name}`}
                    data-testid={`member-select-${user.id}`}
                    className="h-4 w-4 rounded border-white/20 bg-black/20"
                  />
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white font-medium border border-white/5">
                      {user.first_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        user.status === 'active'
                          ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                          : user.status === 'inactive'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                      }`}
                    />
                    <span className="text-sm text-gray-300 capitalize">{user.status}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-sm text-gray-400 hidden md:table-cell">
                  {formatDate(user.updated_at)}
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      data-testid={`member-edit-${user.id}`}
                      className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      aria-label={`Editar ${user.first_name} ${user.last_name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(user.id)}
                      data-testid={`member-deactivate-${user.id}`}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-300 transition-colors"
                      aria-label={`Desactivar ${user.first_name} ${user.last_name}`}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onView(user)}
                      data-testid={`member-view-${user.id}`}
                      className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      aria-label={`Ver detalle de ${user.first_name} ${user.last_name}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <details className="relative">
                      <summary className="list-none p-2 rounded-lg hover:bg-white/10 text-gray-300 cursor-pointer">
                        <MoreVertical className="w-4 h-4" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-white/10 bg-[#0f131a] shadow-2xl p-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            onView(user);
                            closeDetailsMenu(event.currentTarget);
                          }}
                          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                        >
                          <Eye className="w-4 h-4" />
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            onEdit(user);
                            closeDetailsMenu(event.currentTarget);
                          }}
                          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            onDelete(user.id);
                            closeDetailsMenu(event.currentTarget);
                          }}
                          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
                        >
                          <UserX className="w-4 h-4" />
                          Desactivar
                        </button>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
