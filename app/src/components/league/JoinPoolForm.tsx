'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export function JoinPoolForm() {
  const [code, setCode] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode) {
      router.push(`/join/${cleanCode}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
      <input
        type="text"
        placeholder="CÓDIGO DE INVITACIÓN"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="field font-mono text-center tracking-widest text-sm py-2 px-3 flex-1 uppercase"
        required
      />
      <button type="submit" className="btn-gold text-xs py-2 px-5 uppercase tracking-wider font-semibold whitespace-nowrap">
        Unirse a Polla
      </button>
    </form>
  );
}
