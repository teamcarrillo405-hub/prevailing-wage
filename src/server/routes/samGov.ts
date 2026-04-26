// src/server/routes/samGov.ts
// Phase 82 (Gap-2): SAM.gov entity proxy for DBE/MBE/WBE verification.
// SAM.gov public API: https://api.sam.gov/entity-information/v3/entities
//
// Why proxy: bypass browser CORS and avoid leaking the contracting officer's
// search query to a 3rd party from the client. Also lets us cache to keep us
// well under SAM's 1000-req/hour rate limit on shared API keys.
//
// API key: defaults to the SAM-published DEMO_KEY for unauthenticated low-vol
// lookups. Set SAM_GOV_API_KEY in production for higher quotas.

import { Router } from 'express';
import { logger } from '../logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SAM_BASE = 'https://api.sam.gov/entity-information/v3/entities';
const SAM_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_RESULTS = 25;

interface CachedEntry {
  cachedAt: number;
  result: NormalisedEntity[];
}

interface NormalisedEntity {
  entityName: string;
  uei: string | null;
  cage: string | null;
  registrationStatus: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  physicalAddress: {
    line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  certifications: string[];
  naicsCodes: string[];
}

const cache = new Map<string, CachedEntry>();

function cacheKey(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v).toLowerCase()}`)
    .join('&');
}

function getCached(key: string): NormalisedEntity[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.result;
}

function setCached(key: string, result: NormalisedEntity[]): void {
  // Naive size cap to prevent unbounded growth
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { cachedAt: Date.now(), result });
}

function getApiKey(): string {
  return process.env.SAM_GOV_API_KEY || 'DEMO_KEY';
}

/**
 * Pull cert / socio-economic indicators out of a SAM entity record. The SAM v3
 * payload buries these in `coreData.businessTypes.businessTypeList[]` and in
 * `assertions.certifications`. We map the common DBE/MBE/WBE/SBE/HUBZone codes
 * back to the labels we use in the cert form.
 */
function extractCertifications(entity: Record<string, unknown>): string[] {
  const certs = new Set<string>();
  const coreData = entity['coreData'] as Record<string, unknown> | undefined;
  const businessTypes = coreData?.['businessTypes'] as Record<string, unknown> | undefined;
  const list = businessTypes?.['businessTypeList'] as Array<Record<string, unknown>> | undefined;

  if (Array.isArray(list)) {
    for (const item of list) {
      const code = String(item['businessTypeCode'] ?? '').toUpperCase();
      const desc = String(item['businessTypeDesc'] ?? '');

      if (code === 'A5' || /minority/i.test(desc)) certs.add('MBE');
      if (code === 'A8' || /women[- ]owned/i.test(desc)) certs.add('WBE');
      if (code === 'XS' || /small business/i.test(desc)) certs.add('SBE');
      if (code === '23' || /8\(a\)/i.test(desc)) certs.add('8(a)');
      if (code === 'XX' || /hubzone/i.test(desc)) certs.add('HUBZone');
      if (/disadvantaged business/i.test(desc)) certs.add('DBE');
      if (/airport concessions disadvantaged/i.test(desc)) certs.add('ACDBE');
      if (/veteran[- ]owned/i.test(desc)) certs.add('VOSB');
      if (/service[- ]disabled veteran/i.test(desc)) certs.add('SDVOSB');
    }
  }

  return Array.from(certs);
}

function extractNaicsCodes(entity: Record<string, unknown>): string[] {
  const assertions = entity['assertions'] as Record<string, unknown> | undefined;
  const goods = assertions?.['goodsAndServices'] as Record<string, unknown> | undefined;
  const naicsList = goods?.['naicsList'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(naicsList)) return [];
  return naicsList
    .map(n => String(n['naicsCode'] ?? '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function normaliseEntity(entity: Record<string, unknown>): NormalisedEntity {
  const entityRegistration = entity['entityRegistration'] as Record<string, unknown> | undefined;
  const coreData = entity['coreData'] as Record<string, unknown> | undefined;
  const physical = coreData?.['physicalAddress'] as Record<string, unknown> | undefined;

  return {
    entityName: String(entityRegistration?.['legalBusinessName'] ?? '') || 'Unknown',
    uei: (entityRegistration?.['ueiSAM'] as string | undefined) ?? null,
    cage: (entityRegistration?.['cageCode'] as string | undefined) ?? null,
    registrationStatus: (entityRegistration?.['registrationStatus'] as string | undefined) ?? null,
    registrationDate: (entityRegistration?.['registrationDate'] as string | undefined) ?? null,
    expirationDate: (entityRegistration?.['registrationExpirationDate'] as string | undefined) ?? null,
    physicalAddress: {
      line1: (physical?.['addressLine1'] as string | undefined) ?? null,
      city: (physical?.['city'] as string | undefined) ?? null,
      state: (physical?.['stateOrProvinceCode'] as string | undefined) ?? null,
      zip: (physical?.['zipCode'] as string | undefined) ?? null,
    },
    certifications: extractCertifications(entity),
    naicsCodes: extractNaicsCodes(entity),
  };
}

async function callSamGov(
  searchParams: URLSearchParams,
): Promise<{ entities: NormalisedEntity[]; status: number; error?: string }> {
  const url = `${SAM_BASE}?${searchParams.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAM_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        entities: [],
        status: res.status,
        error: `SAM.gov returned ${res.status}: ${body.slice(0, 240)}`,
      };
    }

    const json = (await res.json()) as Record<string, unknown>;
    const entityData = json['entityData'];
    if (!Array.isArray(entityData)) {
      return { entities: [], status: 200 };
    }

    const entities = entityData
      .slice(0, MAX_RESULTS)
      .map(e => normaliseEntity(e as Record<string, unknown>));
    return { entities, status: 200 };
  } catch (err) {
    clearTimeout(timer);
    const message = (err as Error).name === 'AbortError'
      ? `SAM.gov request timed out after ${SAM_TIMEOUT_MS}ms`
      : `SAM.gov request failed: ${(err as Error).message}`;
    logger.warn({ err: message }, '[sam-gov] proxy error');
    return { entities: [], status: 504, error: message };
  }
}

// GET /api/sam-gov/search?name=&uei=&cage=
router.get('/search', async (req, res) => {
  const name = (req.query.name as string | undefined)?.trim();
  const uei = (req.query.uei as string | undefined)?.trim();
  const cage = (req.query.cage as string | undefined)?.trim();

  if (!name && !uei && !cage) {
    res.status(400).json({ error: 'Provide at least one of: name, uei, cage' });
    return;
  }

  const cacheParams = { name, uei, cage };
  const key = cacheKey(cacheParams);
  const cached = getCached(key);
  if (cached) {
    res.json({ data: { results: cached, cached: true } });
    return;
  }

  const params = new URLSearchParams();
  params.set('api_key', getApiKey());
  // SAM.gov requires a registrationStatus filter to keep responses small
  params.set('registrationStatus', 'A');
  // Z1 = primary registration purpose code; broader than Z2/Z3
  params.set('purposeOfRegistrationCode', 'Z1');
  params.set('samRegistered', 'Yes');
  if (name) params.set('entityName', name);
  if (uei) params.set('ueiSAM', uei);
  if (cage) params.set('cageCode', cage);

  const { entities, status, error } = await callSamGov(params);
  if (error) {
    res.status(status >= 500 ? 502 : status).json({ error, data: { results: [] } });
    return;
  }

  setCached(key, entities);
  res.json({ data: { results: entities, cached: false } });
});

// GET /api/sam-gov/entity/:uei
router.get('/entity/:uei', async (req, res) => {
  const uei = req.params.uei?.trim();
  if (!uei) {
    res.status(400).json({ error: 'UEI is required' });
    return;
  }

  const key = cacheKey({ uei });
  const cached = getCached(key);
  if (cached) {
    const single = cached[0] ?? null;
    res.json({ data: { entity: single, cached: true } });
    return;
  }

  const params = new URLSearchParams();
  params.set('api_key', getApiKey());
  params.set('ueiSAM', uei);
  params.set('samRegistered', 'Yes');

  const { entities, status, error } = await callSamGov(params);
  if (error) {
    res.status(status >= 500 ? 502 : status).json({ error, data: { entity: null } });
    return;
  }

  setCached(key, entities);
  res.json({ data: { entity: entities[0] ?? null, cached: false } });
});

export default router;
