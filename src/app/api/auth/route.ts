// @Jules: Auth route handler — syncs InsForge auth tokens to HTTP-only cookies for SSR.
import { createAuthRouteHandlers } from '@insforge/nextjs/api';
import { NextResponse } from 'next/server';

const handlers = createAuthRouteHandlers({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '',
});

const isAuthDisabled = (process.env.GYMCRM_DATA_MODE ?? 'demo') !== 'live';

const authDisabledResponse = () =>
  NextResponse.json(
    {
      error: {
        code: 'auth_disabled',
        message: 'Autenticación deshabilitada en modo abierto MVP.',
      },
    },
    { status: 404 }
  );

export const POST = async (...args: Parameters<typeof handlers.POST>) => {
  if (isAuthDisabled) return authDisabledResponse();
  return handlers.POST(...args);
};

export const GET = async (...args: Parameters<typeof handlers.GET>) => {
  if (isAuthDisabled) return authDisabledResponse();
  return handlers.GET(...args);
};

export const DELETE = async (...args: Parameters<typeof handlers.DELETE>) => {
  if (isAuthDisabled) return authDisabledResponse();
  return handlers.DELETE(...args);
};
