import type { ApiResponse } from '@/shared/types/response';

export function ok<T>(data: T, message: string): ApiResponse<T> {
  return { message, data };
}
