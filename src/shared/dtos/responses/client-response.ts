import { z } from 'zod';

// The wire envelope. `data` stays `unknown` here and is validated separately by the caller's own
// DTO schema: a generic member stops Zod 4 from inferring the object's output type at all.
export const clientResponseSchema = z.object({
  message: z.string(),
  data: z.unknown(),
});
