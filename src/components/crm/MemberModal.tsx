'use client';

import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Member } from './MemberTable';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Partial<Member>) => Promise<void>;
  member?: Member | null;
  readOnly?: boolean;
}

export function MemberModal({ isOpen, onClose, onSave, member, readOnly = false }: MemberModalProps) {
  const [formData, setFormData] = useState<Partial<Member>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    status: 'active',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData(member);
    } else {
      setFormData({ first_name: '', last_name: '', email: '', phone: '', status: 'active' });
    }
  }, [member, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/[0.02]">
          <h2 className="text-xl font-bold text-white">
            {readOnly ? 'Detalle de Cliente' : member ? 'Editar Miembro' : 'Nuevo Miembro'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Nombre</label>
              <input
                required
                readOnly={readOnly}
                type="text"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                value={formData.first_name || ''}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Apellido</label>
              <input
                required
                readOnly={readOnly}
                type="text"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                value={formData.last_name || ''}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Email</label>
            <input
              required
              readOnly={readOnly}
              type="email"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Teléfono</label>
            <input
              readOnly={readOnly}
              type="tel"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</label>
            <select
              disabled={readOnly}
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 appearance-none"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="suspended">Suspendido</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 bg-transparent text-white font-medium hover:bg-white/5 transition-colors"
            >
              {readOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!readOnly ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow-lg hover:shadow-indigo-500/25 transition-all text-center flex justify-center items-center"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : member ? (
                  'Guardar Cambios'
                ) : (
                  'Crear Miembro'
                )}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
