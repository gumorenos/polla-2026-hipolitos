'use client';

import React, { useState } from 'react';
import { User } from '@prisma/client';
import { toggleUserSuperadminAction } from '../../../lib/actions/admin';
import { useRouter } from 'next/navigation';

export default function UsersAdminClient({ users, currentUserId }: { users: User[], currentUserId: string }) {
  const router = useRouter();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleToggleSuperadmin = async (userId: string, currentVal: boolean) => {
    const actionLabel = currentVal ? 'quitar' : 'dar';
    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} el rol de Superadmin a este usuario?`)) {
      return;
    }

    setLoadingUserId(userId);
    setError(null);
    setSuccess(null);

    const res = await toggleUserSuperadminAction(userId, !currentVal);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Usuario actualizado exitosamente');
      router.refresh();
    }
    setLoadingUserId(null);
  };

  return (
    <div className="space-y-6">
      {error && <div className="p-4 bg-red-900/50 text-red-200 border border-red-500 rounded-md">{error}</div>}
      {success && <div className="p-4 bg-green-900/50 text-green-200 border border-green-500 rounded-md">{success}</div>}

      <div className="card-base overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-surface border-b border-border text-text-muted">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Email</th>
              <th className="p-3">Rol</th>
              <th className="p-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const isYou = user.id === currentUserId;
              return (
                <tr key={user.id} className="hover:bg-surface transition-colors">
                  <td className="p-3 font-semibold">
                    {user.displayName || user.name}
                    {isYou && <span className="text-[10px] text-gold border border-gold/30 px-1.5 py-0.5 rounded ml-2 uppercase font-mono tracking-wider">TÚ</span>}
                  </td>
                  <td className="p-3 font-mono text-xs">{user.email}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full uppercase border ${
                      user.isSuperadmin ? 'bg-gold-400/10 text-gold-400 border-gold-400/30 font-semibold' : 'bg-surface border-border text-text-muted'
                    }`}>
                      {user.isSuperadmin ? 'Superadmin' : 'Usuario'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {!isYou && (
                      <button
                        onClick={() => handleToggleSuperadmin(user.id, user.isSuperadmin)}
                        disabled={loadingUserId === user.id}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${
                          user.isSuperadmin 
                            ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
                            : 'bg-gold-400/10 border-gold-400/30 text-gold-400 hover:bg-gold-400/20'
                        }`}
                      >
                        {loadingUserId === user.id ? 'Cargando...' : user.isSuperadmin ? 'Quitar Superadmin' : 'Hacer Superadmin'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
