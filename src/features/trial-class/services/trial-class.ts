import 'server-only';
import { HTTPException } from 'hono/http-exception';
import { ErrorMessageConstant } from '@/shared/constants/messages';
import { trialClassRepo } from '@/features/trial-class/repositories/trial-class';
import { mapTrialClass, type TrialClassResponse } from '@/features/trial-class/dtos/v1/responses/trial-class';
import { mapRoster, type RosterResponse } from '@/features/trial-class/dtos/v1/responses/roster';

export const trialClassService = {
  async list(): Promise<TrialClassResponse[]> {
    const rows = await trialClassRepo.findAllWithConfirmedCount();
    return rows.map(mapTrialClass);
  },

  async roster(id: string): Promise<RosterResponse> {
    const all = await trialClassRepo.findAllWithConfirmedCount();
    const found = all.find((c) => c.id === id);
    if (!found) throw new HTTPException(404, { message: ErrorMessageConstant.DataEntityNotFound('Trial class') });
    return mapRoster(mapTrialClass(found), await trialClassRepo.findRoster(id));
  },

  // Admin page. A handful of classes, so one roster query per class is fine.
  async listWithRoster(): Promise<RosterResponse[]> {
    const all = await trialClassRepo.findAllWithConfirmedCount();
    return Promise.all(all.map(async (c) => mapRoster(mapTrialClass(c), await trialClassRepo.findRoster(c.id))));
  },
};
