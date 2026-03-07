import { GYM_ROLES, type GymRole } from '@/lib/gymcrm/types';

export type OpenRole = GymRole;
export type DataMode = 'demo' | 'live';
export type NavMode = 'demo_all' | 'role_scoped';

export const OPEN_ROLE_COOKIE = 'gymcrm_open_role';
export const OPEN_ROLE_STORAGE_KEY = 'gymcrm_open_role';
export const DEFAULT_OPEN_ROLE: OpenRole = 'admin';
export const DEFAULT_GYM_ID = process.env.GYMCRM_OPEN_GYM_ID?.trim() || 'demo-gym-001';

export const OPEN_ROLES: readonly OpenRole[] = GYM_ROLES;

const parseCookieHeader = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const separator = entry.indexOf('=');
      if (separator <= 0) return acc;
      const key = entry.slice(0, separator).trim();
      const value = entry.slice(separator + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
};

export const isOpenRole = (value: string | null | undefined): value is OpenRole => {
  if (!value) return false;
  return OPEN_ROLES.includes(value as OpenRole);
};

export const normalizeOpenRole = (value: string | null | undefined): OpenRole => {
  if (isOpenRole(value)) return value;
  return DEFAULT_OPEN_ROLE;
};

export const getGymcrmDataMode = (): DataMode => {
  return process.env.GYMCRM_DATA_MODE === 'live' ? 'live' : 'demo';
};

export const getGymcrmNavMode = (): NavMode => {
  return process.env.NEXT_PUBLIC_GYMCRM_NAV_MODE === 'role_scoped' ? 'role_scoped' : 'demo_all';
};

export const readOpenRoleFromCookieHeader = (cookieHeader: string | null | undefined): OpenRole => {
  const cookies = parseCookieHeader(cookieHeader ?? null);
  return normalizeOpenRole(cookies[OPEN_ROLE_COOKIE]);
};

export const readOpenRoleFromRequest = (request: Request): OpenRole => {
  return readOpenRoleFromCookieHeader(request.headers.get('cookie'));
};
