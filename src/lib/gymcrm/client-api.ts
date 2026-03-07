export type ApiError = {
  error:
    | string
    | {
        code: string;
        message: string;
        details?: unknown;
      };
};

export class ApiClientError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(message: string, options: { code?: string; details?: unknown; status: number }) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options.code ?? 'request_failed';
    this.details = options.details;
    this.status = options.status;
  }
}

const extractErrorMessage = (payload: unknown, status: number): string => {
  if (typeof payload === 'object' && payload !== null) {
    const maybePayload = payload as Record<string, unknown>;
    const errorValue = maybePayload.error;

    if (typeof errorValue === 'string' && errorValue.trim()) {
      return errorValue;
    }

    if (typeof errorValue === 'object' && errorValue !== null) {
      const maybeError = errorValue as Record<string, unknown>;
      if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
        return maybeError.message;
      }
    }

    if (typeof maybePayload.message === 'string' && maybePayload.message.trim()) {
      return maybePayload.message;
    }
  }

  return `Request failed (${status})`;
};

const extractErrorCode = (payload: unknown): string | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const maybePayload = payload as Record<string, unknown>;
  const errorValue = maybePayload.error;
  if (typeof errorValue === 'object' && errorValue !== null) {
    const maybeError = errorValue as Record<string, unknown>;
    if (typeof maybeError.code === 'string' && maybeError.code.trim()) {
      return maybeError.code;
    }
  }
  return undefined;
};

const extractErrorDetails = (payload: unknown): unknown => {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const maybePayload = payload as Record<string, unknown>;
  const errorValue = maybePayload.error;
  if (typeof errorValue === 'object' && errorValue !== null) {
    const maybeError = errorValue as Record<string, unknown>;
    return maybeError.details;
  }
  return undefined;
};

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiClientError(extractErrorMessage(payload, response.status), {
      code: extractErrorCode(payload),
      details: extractErrorDetails(payload),
      status: response.status,
    });
  }

  return payload as T;
}

export async function apiMutation<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiClientError(extractErrorMessage(payload, response.status), {
      code: extractErrorCode(payload),
      details: extractErrorDetails(payload),
      status: response.status,
    });
  }

  return payload as T;
}
