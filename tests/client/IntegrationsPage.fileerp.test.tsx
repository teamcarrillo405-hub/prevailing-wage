import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 126 — FileErpCard rendering (INTG-01)', () => {
  const src = readFileSync(resolve(__dirname, '../../src/client/pages/IntegrationsPage.tsx'), 'utf-8');

  it('contains Sage 300 CRE card', () => {
    expect(src).toMatch(/erpName=["']Sage 300 CRE["']/);
    expect(src).toMatch(/erpType=["']sage300["']/);
  });

  it('contains Viewpoint Vista card', () => {
    expect(src).toMatch(/erpName=["']Viewpoint Vista["']/);
    expect(src).toMatch(/erpType=["']vista["']/);
  });

  it('uses Badge variant="warning" for File Exchange', () => {
    expect(src).toMatch(/variant=["']warning["']>\s*File Exchange/);
  });

  it('contains the persistent notice copy', () => {
    expect(src).toContain('No live connection — place export files in the configured import directory.');
  });

  it('defines FileErpCard as a local component (not a separate file)', () => {
    expect(src).toMatch(/function FileErpCard\(/);
    expect(() => readFileSync(resolve(__dirname, '../../src/client/components/ui/FileErpCard.tsx'), 'utf-8')).toThrow();
  });

  it('calls POST /api/erp-integrations/:erpType/sync', () => {
    expect(src).toMatch(/\/api\/erp-integrations\/\$\{erpType\}\/sync/);
  });

  it('calls POST /api/erp-integrations/:erpType/config', () => {
    expect(src).toMatch(/\/api\/erp-integrations\/\$\{erpType\}\/config/);
  });

  it('security footnote mentions Sage 300 CRE and Viewpoint Vista alongside AES-256-GCM', () => {
    expect(src).toMatch(/Sage 300 CRE.*Viewpoint Vista|Viewpoint Vista.*Sage 300 CRE/);
    expect(src).toMatch(/AES-256-GCM/);
  });
});
