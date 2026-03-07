import { ApiClientError } from '@/lib/gymcrm/client-api';

export const toUserErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiClientError) {
    if (error.code) {
      return `${error.message} [${error.code}]`;
    }
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};
