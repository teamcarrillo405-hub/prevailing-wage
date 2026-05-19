import { getDb } from '../db/index.js';

export interface DbeReportLine {
  tier: number;
  subName: string;
  dbeCert: string | null;
  contractValue: number;
  percentOfPrime: number;
}

export async function generateDbeReport(projectId: number): Promise<DbeReportLine[]> {
  const db = getDb();
  const rawClient = (db as any).$client as {
    prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] };
  };

  // Recursive CTE to walk the sub hierarchy up to 3 tiers
  const SQL = `
    WITH RECURSIVE sub_tree(id, name, dbe_certification, contract_value, parent_sub_id, tier) AS (
      SELECT id, name, dbe_certification, contract_value, parent_sub_id, 1
      FROM subcontractors WHERE project_id = ? AND parent_sub_id IS NULL
      UNION ALL
      SELECT s.id, s.name, s.dbe_certification, s.contract_value, s.parent_sub_id, st.tier + 1
      FROM subcontractors s JOIN sub_tree st ON s.parent_sub_id = st.id
      WHERE st.tier < 3
    )
    SELECT * FROM sub_tree ORDER BY tier, name
  `;

  const rows = rawClient.prepare(SQL).all(projectId) as Array<{
    id: number;
    name: string;
    dbe_certification: string | null;
    contract_value: number | null;
    parent_sub_id: number | null;
    tier: number;
  }>;

  const totalContract = rows
    .filter(r => r.tier === 1)
    .reduce((sum, r) => sum + (r.contract_value ?? 0), 0);

  return rows.map(r => ({
    tier: r.tier,
    subName: r.name,
    dbeCert: r.dbe_certification,
    contractValue: r.contract_value ?? 0,
    percentOfPrime: totalContract > 0
      ? Math.round(((r.contract_value ?? 0) / totalContract) * 1000) / 10
      : 0,
  }));
}
