import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { conn } from '@/shared/lib/db/db';
import type { DbTransaction } from '@/shared/lib/db/db';
import { parents, students } from '@/shared/db/schema';

export const parentRepo = {
  async findAllWithStudents(tx?: DbTransaction) {
    return conn(tx).query.parents.findMany({
      columns: { id: true, name: true },
      with: { students: { columns: { id: true, name: true }, orderBy: asc(students.name) } },
      orderBy: asc(parents.name),
    });
  },

  async findStudent(id: string, tx?: DbTransaction) {
    return conn(tx).query.students.findFirst({ where: eq(students.id, id) });
  },
};

export type ParentWithStudents = Awaited<ReturnType<typeof parentRepo.findAllWithStudents>>[number];
