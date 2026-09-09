import 'server-only';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { config } from '@/shared/config';
import { ErrorMessageConstant } from '@/shared/constants/messages';
import { ValidationException } from '@/shared/lib/exceptions/validation-exception';
import { ConflictException } from '@/shared/lib/exceptions/conflict-exception';
import { errorDetail } from '@/shared/utils/error-detail/error-detail';
import { isUniqueViolation } from '@/shared/utils/pg-error/pg-error';
import type { ApiError } from '@/shared/types/response';

export const app = new Hono().basePath('/api');
// Bare v1 router; feature routers mount onto it in app/api/[[...route]]/route.ts.
export const v1 = new Hono();

app.use(logger());

app.onError((err, c) => {
  if (err instanceof ValidationException) {
    const body: ApiError = { message: err.message, errors: err.errors };
    return c.json(body, 422);
  }
  if (err instanceof ConflictException) {
    const body: ApiError = { message: err.message, error: err.message, data: err.data };
    return c.json(body, 409);
  }
  if (err instanceof HTTPException) {
    const body: ApiError = { message: err.message, error: err.message };
    c.status(err.status);
    return c.json(body);
  }
  // DB backstop (unique index) fired outside the service's own checks: a conflict, not a crash.
  if (isUniqueViolation(err)) {
    const body: ApiError = { message: ErrorMessageConstant.Conflict() };
    return c.json(body, 409);
  }
  const body: ApiError = {
    message: ErrorMessageConstant.InternalServerError(),
    error: errorDetail(err, config.isProduction),
  };
  return c.json(body, 500);
});

app.notFound((c) => {
  const body: ApiError = { message: ErrorMessageConstant.ResourceNotFound() };
  return c.json(body, 404);
});
