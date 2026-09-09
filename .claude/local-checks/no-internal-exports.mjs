// Fails when a symbol is exported but never referenced by another file.
//
// knip cannot express this: it treats a type as used when an exported value's signature
// references it (e.g. `findById(): Promise<TrialClassRow>`), so a symbol consumed only inside
// its own file passes knip while still violating the "don't export what's only used in its own
// file" rule in .claude/rules/architecture.md.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Searched for usage, but their own exports are not audited: framework entry points, vendored
// primitives, and the Drizzle schema (consumed via `import * as schema`, so names never appear).
const NOT_AUDITED = [
  'src/app/',
  'src/shared/components/ui/',
  'src/shared/db/schema.ts',
];

const walk = (dir, exts) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && exts.some((e) => d.name.endsWith(e)))
    .map((d) => join(d.parentPath, d.name));

const files = [...walk('src', ['.ts', '.tsx']), ...walk('scripts', ['.ts', '.mjs'])];
const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

const isAudited = (f) => !NOT_AUDITED.some((p) => f.includes(p));

const EXPORT_RE = /^export\s+(?:declare\s+)?(?:async\s+)?(?:type|interface|const|function|class)\s+([A-Za-z_$][\w$]*)/gm;

const violations = [];
for (const [file, src] of sources) {
  if (!isAudited(file)) continue;
  for (const [, name] of src.matchAll(EXPORT_RE)) {
    const usedElsewhere = [...sources].some(
      ([other, text]) => other !== file && new RegExp(`\\b${name}\\b`).test(text),
    );
    if (!usedElsewhere) violations.push(`${file}: ${name}`);
  }
}

if (violations.length > 0) {
  console.error('Exported but only used inside its own file — drop the `export`:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`no-internal-exports: ${sources.size} files scanned, clean`);
