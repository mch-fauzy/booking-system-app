// Plain, client-shareable response contracts (no server-only).
export interface ApiResponse<T> {
  message: string;
  data: T;
}

export interface ApiError {
  message: string;
  error?: string | null;
  errors?: unknown;
  data?: unknown; // e.g. 409 payload such as { existingBookingId }
}
