import { NextResponse } from 'next/server';

export type ApiErrorEnvelope = {
  code: string;
  message: string;
  details?: unknown;
};

export const apiErrorEnvelope = (
  message: string,
  code = 'bad_request',
  details?: unknown
): ApiErrorEnvelope => {
  return {
    code,
    message,
    details,
  };
};

export const ok = <T>(data: T, init?: ResponseInit) => {
  return NextResponse.json({ data }, init);
};

export const okList = <T>(data: T[], count?: number, init?: ResponseInit) => {
  return NextResponse.json({ data, count }, init);
};

export const fail = (message: string, status = 400, code = 'bad_request', details?: unknown) => {
  return NextResponse.json({ error: apiErrorEnvelope(message, code, details) }, { status });
};

export const parseJsonBody = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error('Body JSON inválido.');
  }
};
