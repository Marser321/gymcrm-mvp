'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_OPEN_ROLE,
  OPEN_ROLE_COOKIE,
  OPEN_ROLE_STORAGE_KEY,
  isOpenRole,
  type OpenRole,
  normalizeOpenRole,
} from '@/lib/gymcrm/open-session';

const readRoleFromCookie = (): OpenRole | null => {
  if (typeof document === 'undefined') return null;

  const cookieEntry = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${OPEN_ROLE_COOKIE}=`));

  if (!cookieEntry) return null;
  const raw = decodeURIComponent(cookieEntry.slice(cookieEntry.indexOf('=') + 1));
  if (!isOpenRole(raw)) return null;
  return raw;
};

const readRoleFromLocalStorage = (): OpenRole | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(OPEN_ROLE_STORAGE_KEY);
  if (!isOpenRole(raw)) return null;
  return raw;
};

const persistRole = (role: OpenRole) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(OPEN_ROLE_STORAGE_KEY, role);
  }

  if (typeof document !== 'undefined') {
    document.cookie = `${OPEN_ROLE_COOKIE}=${encodeURIComponent(role)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
};

export const useOpenSession = () => {
  const [role, setRole] = useState<OpenRole>(DEFAULT_OPEN_ROLE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const localRole = readRoleFromLocalStorage();
    const cookieRole = readRoleFromCookie();
    const resolved = cookieRole ?? localRole ?? DEFAULT_OPEN_ROLE;
    persistRole(resolved);
    setRole(resolved);
    setReady(true);
  }, []);

  const updateRole = useCallback((nextRole: OpenRole) => {
    const normalized = normalizeOpenRole(nextRole);
    persistRole(normalized);
    setRole(normalized);
    return normalized;
  }, []);

  return {
    role,
    ready,
    setRole: updateRole,
  };
};
