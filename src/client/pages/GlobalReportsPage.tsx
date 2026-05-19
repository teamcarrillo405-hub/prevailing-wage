// src/client/pages/GlobalReportsPage.tsx
// Top-level Reports hub — cross-project CSV exports and compliance dashboard.
// Route: /reports (protected)

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, ClipboardList, Users, GraduationCap } from 'lucide-react';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface ComplianceSummaryRow {
  projectId: string;
  projectName: string;
  state: string;
  weekCount: number;
  submittedCount: number;
  violationCount: number;
  totalWages: number;
  apprenticeHours: number;
  totalHours: number;
}

interface Project {
  id: string;
  name: string;
  state: string;
  status: string;
}

// ── Report Card ──────────────────────────────────────────────────────────────

interface ReportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  downloadLabel?: string;
  downloadHref?: string;
  downloadFilename?: string;
  children?: React.ReactNode;
}

function ReportCard({ icon, title, description, downloadLabel, downloadHref, downloadFilename, children }: ReportCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-brand-gold/10 text-nav-dark shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
      {downloadHref && (
        <a
          href={downloadHref}
          download={downloadFilename}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-nav-dark text-white text-sm font-medium hover:bg-nav-dark/90 transition-colors min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          {downloadLabel ?? 'Download CSV'}
        </a>
      )}
    </div>
  );
}

// ── Currency formatter ────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function GlobalReportsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Projects list for wage-statement selector
  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-reports'],
    queryFn: () => api.get<{ data: { projects: Project[] } }>('/projects'),
    staleTime: 60_000,
  });

  const allProjects = projectsData?.data?.projects ?? [];

  // Compliance summary table
  const {
    data: complianceData,
    isLoading: complianceLoading,
    error: complianceError,
  } = useQuery({
    queryKey: ['reports-compliance-summary'],
    queryFn: () => api.get<{ rows: ComplianceSummaryRow[] }>('/reports/compliance-summary'),
    staleTime: 5 * 60_000,
  });

  const complianceRows = complianceData?.rows ?? [];

  const wageStatementHref = selectedProjectId
    ? `/api/reports/export-csv?report=wage-statement&projectId=${selectedProjectId}`
    : undefined;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">

        <PageHeader title="Reports" />

        {/* Report type cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ReportCard
            icon={<ClipboardList className="w-5 h-5" />}
            title="Compliance Summary"
            description="Project-level CPR submission status: weeks submitted, violations, and total wages across all your projects."
            downloadLabel="Download CSV"
            downloadHref="/api/reports/export-csv?report=compliance"
            downloadFilename="compliance-summary.csv"
          />

          <ReportCard
            icon={<Users className="w-5 h-5" />}
            title="Wage Statement by Worker"
            description="Per-worker summary of total hours and gross wages for a selected project — ideal for Labor Department audits."
            downloadLabel={selectedProjectId ? 'Download CSV' : undefined}
            downloadHref={wageStatementHref}
            downloadFilename="wage-statement.csv"
          >
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600" htmlFor="ws-project-select">
                Select Project
              </label>
              <select
                id="ws-project-select"
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold min-h-[40px]"
              >
                <option value="">-- Choose a project --</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.state})</option>
                ))}
              </select>
              {!selectedProjectId && (
                <p className="text-xs text-gray-400">Select a project to enable download</p>
              )}
            </div>
          </ReportCard>

          <ReportCard
            icon={<GraduationCap className="w-5 h-5" />}
            title="Economic Impact Report"
            description="Aggregate wages-by-craft, fringe ratio, and project rankings — exportable for grant reporting and stakeholder presentations."
            downloadLabel="Download CSV"
            downloadHref="/api/reports/export-csv?report=economic-impact"
            downloadFilename="economic-impact.csv"
          />
        </div>

        {/* Compliance Summary table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Compliance Summary — All Projects</h2>
              <p className="text-xs text-gray-400 mt-0.5">CPR submission health across your entire portfolio</p>
            </div>
            <a
              href="/api/reports/export-csv?report=compliance"
              download="compliance-summary.csv"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </a>
          </div>

          {complianceLoading && (
            <div className="p-8 text-center text-sm text-gray-400">Loading compliance data...</div>
          )}

          {complianceError && (
            <div className="p-8 text-center text-sm text-red-600">Failed to load compliance summary.</div>
          )}

          {!complianceLoading && !complianceError && complianceRows.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">
              No projects found. Create a project and enter payroll to see compliance data here.
            </div>
          )}

          {!complianceLoading && !complianceError && complianceRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">State</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Weeks</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Violations</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Wages</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">App. Hours</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {complianceRows.map(row => (
                    <tr key={row.projectId} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                        {row.projectName}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{row.state}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{row.weekCount}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{row.submittedCount}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${row.violationCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {row.violationCount}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">{fmtCurrency(row.totalWages)}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{row.apprenticeHours.toFixed(1)}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{row.totalHours.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-5 py-3 text-gray-900" colSpan={2}>Totals</td>
                    <td className="px-5 py-3 text-right text-gray-900">
                      {complianceRows.reduce((s, r) => s + r.weekCount, 0)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900">
                      {complianceRows.reduce((s, r) => s + r.submittedCount, 0)}
                    </td>
                    <td className={`px-5 py-3 text-right ${complianceRows.reduce((s, r) => s + r.violationCount, 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {complianceRows.reduce((s, r) => s + r.violationCount, 0)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900">
                      {fmtCurrency(complianceRows.reduce((s, r) => s + r.totalWages, 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900">
                      {complianceRows.reduce((s, r) => s + r.apprenticeHours, 0).toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900">
                      {complianceRows.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
