import { readFileSync, writeFileSync } from 'fs';

const fixes = [
  {
    path: 'src/server/services/dueSoonService.ts',
    from: "logger.error(`[due-soon] Error processing project ${project.id}:`, projectErr);",
    to:   "logger.error({ err: projectErr }, `[due-soon] Error processing project ${project.id}`);",
  },
  {
    path: 'src/server/services/wdolFetcher.ts',
    from: 'logger.warn(`[wdolFetcher] fetch failed for ${wdNumber}:`, err);',
    to:   'logger.warn({ err }, `[wdolFetcher] fetch failed for ${wdNumber}`);',
  },
];

const wdolSyncFixes = [
  {
    from: 'logger.error(`[wdolSync] Phase 1 error refreshing ${wd.wdNumber}:`, err);',
    to:   'logger.error({ err }, `[wdolSync] Phase 1 error refreshing ${wd.wdNumber}`);',
  },
  {
    from: 'logger.error(`[wdolSync] Error syncing ${seed.wdNumber}:`, err);',
    to:   'logger.error({ err }, `[wdolSync] Error syncing ${seed.wdNumber}`);',
  },
];

for (const { path, from, to } of fixes) {
  let c = readFileSync(path, 'utf8');
  if (c.includes(from)) {
    writeFileSync(path, c.replace(from, to));
    console.log(`Fixed: ${path}`);
  } else {
    console.log(`NOT FOUND in ${path}: ${from.slice(0, 50)}`);
  }
}

{
  const path = 'src/server/services/wdolSync.ts';
  let c = readFileSync(path, 'utf8');
  let changed = 0;
  for (const { from, to } of wdolSyncFixes) {
    if (c.includes(from)) { c = c.replace(from, to); changed++; }
    else console.log(`NOT FOUND: ${from.slice(0, 60)}`);
  }
  writeFileSync(path, c);
  console.log(`Fixed ${changed} in ${path}`);
}
