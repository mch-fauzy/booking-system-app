import 'server-only';
import { zValidator } from '@hono/zod-validator';
import type { ZodType } from 'zod';
import { ValidationException } from '@/shared/lib/exceptions/validation-exception';

type ValidateTarget = 'json' | 'query' | 'param';

// zValidator that throws ValidationException (422) so every router shares one error envelope.
export function validate<Target extends ValidateTarget, T extends ZodType>(target: Target, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        messages: [issue.message],
      }));
      throw new ValidationException(errors);
    }
  });
}
