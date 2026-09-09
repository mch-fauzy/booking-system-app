import { HTTPException } from 'hono/http-exception';

// 409 with an optional payload (e.g. the id of the conflicting resource) rendered as `data`.
export class ConflictException extends HTTPException {
  readonly data?: unknown;

  constructor(message: string, data?: unknown) {
    super(409, { message });
    this.data = data;
  }
}
