import { z } from 'zod';

// `/:id` route params, shared by every resource router.
export const idParamSchema = z.object({ id: z.uuid() });
