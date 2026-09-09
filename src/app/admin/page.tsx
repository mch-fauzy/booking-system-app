import { trialClassService } from '@/features/trial-class/services/trial-class';
import { RosterTable } from '@/features/trial-class/components/roster-table';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const rosters = await trialClassService.listWithRoster();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Trial class rosters</h1>
      {rosters.map((r) => <RosterTable key={r.trialClass.id} roster={r} />)}
    </div>
  );
}
