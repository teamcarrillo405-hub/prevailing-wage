import { logger } from '../logger.js';
// src/server/routes/adminWages.ts
// Admin import endpoint for state prevailing wage CSV data.
// Authentication: none in v1 (single-user local tool — see SUMMARY.md decision note).
// Rate this as a future auth TODO when multi-user is added in v2.

import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import { upsertWageDetermination, upsertClassifications } from '../services/wageCache.js';
import { STATE_SOURCE_MAP, STATE_CSV_COLUMNS } from '../services/stateWageAdapter.js';

export const adminWagesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// POST /api/admin/wages/import-state
// Accepts: multipart/form-data with a 'file' field containing a CSV.
// CSV required columns: state, county, wd_number, trade_code, trade_description, labor_type, base_rate, fringe_rate
// construction_type column is optional.
//
// Groups rows by wd_number, inserts one wageDeterminations row per unique WD,
// then inserts all classification rows for that WD.
// Returns: { inserted: N, skipped: 0 } on success.
adminWagesRouter.post('/import-state', upload.single('file'), (req, res) => {
  try {
    // Validate file presence
    if (!req.file) {
      return res.status(400).json({ error: 'No file attached. Send a CSV as multipart/form-data with field name "file".' });
    }

    // Parse CSV from buffer
    let records: Record<string, string>[];
    try {
      records = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
    } catch (parseErr) {
      return res.status(422).json({ error: 'CSV parse error: ' + String(parseErr) });
    }

    if (records.length === 0) {
      return res.status(422).json({ error: 'CSV file is empty (no data rows after header).' });
    }

    // Validate required columns exist in the first record
    const firstRow = records[0];
    const missingCols = STATE_CSV_COLUMNS.filter((col) => !(col in firstRow));
    if (missingCols.length > 0) {
      return res.status(422).json({
        error: `CSV is missing required columns: ${missingCols.join(', ')}`,
        required: STATE_CSV_COLUMNS,
        received: Object.keys(firstRow),
      });
    }

    // Group rows by wd_number
    const grouped = new Map<string, Record<string, string>[]>();
    for (const row of records) {
      const key = row.wd_number;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    let inserted = 0;

    for (const [wdNumber, rows] of grouped) {
      const firstRowForWd = rows[0];
      const state = firstRowForWd.state.toUpperCase();
      const county = firstRowForWd.county;

      // Validate state is supported
      const source = STATE_SOURCE_MAP[state];
      if (!source) {
        return res.status(422).json({
          error: `Unsupported state for state adapter import: "${state}". Supported: ${Object.keys(STATE_SOURCE_MAP).join(', ')}`,
        });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      // Manual state imports expire in 10 years — user must re-import to update
      const cacheExpiresAt = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
      const wdId = crypto.randomUUID();

      upsertWageDetermination({
        id: wdId,
        source,
        wdNumber,
        revisionNumber: 0,
        state,
        county,
        constructionType: firstRowForWd.construction_type ?? null,
        publishDate: nowIso.slice(0, 10),
        rawDocument: null,
        cachedAt: nowIso,
        cacheExpiresAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      upsertClassifications(
        wdId,
        rows.map((row) => ({
          code: row.trade_code.toUpperCase(),
          description: row.trade_description,
          baseRate: parseFloat(row.base_rate),
          fringeRate: parseFloat(row.fringe_rate),
          totalRate: parseFloat((parseFloat(row.base_rate) + parseFloat(row.fringe_rate)).toFixed(2)),
        }))
      );

      inserted++;
    }

    return res.status(200).json({ inserted, skipped: 0 });
  } catch (err) {
    logger.error({ err: err }, '[adminWages] Import error:');
    return res.status(500).json({ error: 'Import failed: ' + String(err) });
  }
});
