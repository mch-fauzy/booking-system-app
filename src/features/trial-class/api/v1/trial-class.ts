import 'server-only';
import { Hono } from 'hono';
import { trialClassService } from '@/features/trial-class/services/trial-class';
import { idParamSchema } from '@/shared/dtos/requests/id-param';
import { ok } from '@/shared/utils/response/response';
import { SuccessMessageConstant } from '@/shared/constants/messages';
import { validate } from '@/shared/lib/validation/validation';

export const trialClassRouter = new Hono();

trialClassRouter.get('/', async (c) => {
  return c.json(ok(await trialClassService.list(), SuccessMessageConstant.EntityRetrieved('Trial classes')));
});

trialClassRouter.get('/:id/roster', validate('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  return c.json(ok(await trialClassService.roster(id), SuccessMessageConstant.EntityRetrieved('Roster')));
});
