import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { formatDateTime } from '@/shared/utils/format-date-time/format-date-time';
import type { RosterResponse } from '@/features/trial-class/dtos/v1/responses/roster';

export function RosterTable({ roster }: { roster: RosterResponse }) {
  const { trialClass, entries } = roster;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">
        {trialClass.subject} — {trialClass.confirmedCount}/{trialClass.capacity} confirmed
        <span className="ml-2 text-sm font-normal text-muted-foreground">{formatDateTime(trialClass.startsAt)}</span>
      </h2>
      {entries.length === 0 ? <p className="text-sm text-muted-foreground">No confirmed students yet.</p> : (
        <Table>
          <TableHeader>
            <TableRow><TableHead>Child</TableHead><TableHead>Parent</TableHead><TableHead>Confirmed at</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.bookingId}>
                <TableCell>{e.student.name}</TableCell>
                <TableCell>{e.parent.name}</TableCell>
                <TableCell>{formatDateTime(e.confirmedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
