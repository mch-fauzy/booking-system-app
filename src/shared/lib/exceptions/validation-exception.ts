import { HTTPException } from 'hono/http-exception';
import { ErrorMessageConstant } from '@/shared/constants/messages';

export class ValidationException extends HTTPException {
  readonly errors: { path: string; messages: string[] }[];

  constructor(errors: { path: string; messages: string[] }[]) {
    super(422, { message: ErrorMessageConstant.ValidationError() });
    this.errors = errors;
  }
}
