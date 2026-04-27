// @vitest-environment jsdom
/**
 * Tests for the Compliance Report Schedule card in ProjectSettingsPage.
 * Covers: parseReportSettings (pure), render states, save-flow (happy + error).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../../src/client/contexts/ToastContext';
import { ToastContainer } from '../../src/client/components/ui/ToastContainer';
import { parseReportSettings, ProjectSettingsPage } from '../../src/client/pages/ProjectSettingsPage';
import { api } from '../../src/client/lib/api';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../src/client/lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Layout and LoadingSpinner are thin wrappers — use pass-through stubs
vi.mock('../../src/client/components/shared/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/client/components/shared/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="spinner" />,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-id',
    name: 'Test Project',
    gpsClockInEnabled: false,
    gpsLatitude: null,
    gpsLongitude: null,
    gpsRadiusMeters: null,
    projectSettings: null,
    ...overrides,
  };
}

function renderPage(project = makeProject()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.get).mockResolvedValue({ data: { project, members: [], isOwner: false } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/projects/test-id/settings']}>
          <Routes>
            <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
          </Routes>
        </MemoryRouter>
        <ToastContainer />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

// ── Parse tests (pure unit, no DOM) ─────────────────────────────────────────

describe('parseReportSettings', () => {
  it('returns defaults when passed null', () => {
    expect(parseReportSettings(null)).toEqual({ reportSchedule: 'off', reportEmail: '' });
  });

  it('returns defaults when passed malformed JSON', () => {
    expect(parseReportSettings('not-json')).toEqual({ reportSchedule: 'off', reportEmail: '' });
  });

  it('extracts valid schedule and email; ignores extra keys', () => {
    const raw = JSON.stringify({ reportSchedule: 'weekly', reportEmail: 'x@y.com', somethingElse: 1 });
    expect(parseReportSettings(raw)).toEqual({ reportSchedule: 'weekly', reportEmail: 'x@y.com' });
  });
});

// ── Render tests ─────────────────────────────────────────────────────────────

describe('ReportScheduleSection render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-populates select and email from projectSettings', async () => {
    const settings = JSON.stringify({ reportSchedule: 'monthly', reportEmail: 'foo@bar.com' });
    renderPage(makeProject({ projectSettings: settings }));

    const select = await screen.findByLabelText(/Report schedule frequency/i);
    expect((select as HTMLSelectElement).value).toBe('monthly');

    const emailInput = await screen.findByLabelText(/Report email recipient/i);
    expect((emailInput as HTMLInputElement).value).toBe('foo@bar.com');
  });

  it('shows "off" and empty email when projectSettings is null', async () => {
    renderPage(makeProject({ projectSettings: null }));

    const select = await screen.findByLabelText(/Report schedule frequency/i);
    expect((select as HTMLSelectElement).value).toBe('off');

    const emailInput = await screen.findByLabelText(/Report email recipient/i);
    expect((emailInput as HTMLInputElement).value).toBe('');
  });
});

// ── Save-flow tests ──────────────────────────────────────────────────────────

describe('ReportScheduleSection save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches PATCH with only projectSettings (no GPS fields)', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { project: makeProject() } });
    const user = userEvent.setup();
    renderPage();

    const select = await screen.findByLabelText(/Report schedule frequency/i);
    await user.selectOptions(select, 'weekly');

    const emailInput = screen.getByLabelText(/Report email recipient/i);
    await user.clear(emailInput);
    await user.type(emailInput, 'new@x.com');

    await user.click(screen.getByRole('button', { name: /Save Report Schedule/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/projects/test-id', {
        projectSettings: '{"reportSchedule":"weekly","reportEmail":"new@x.com"}',
      });
    });

    // Crucially: body must have EXACTLY 1 key (no GPS fields)
    const body = vi.mocked(api.patch).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['projectSettings']);
  });

  it('calls toast.success on successful PATCH', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { project: makeProject() } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('button', { name: /Save Report Schedule/i });
    await user.click(screen.getByRole('button', { name: /Save Report Schedule/i }));

    await waitFor(() => {
      expect(screen.queryByText('Report schedule saved')).toBeTruthy();
    });
  });

  it('calls toast.error on failed PATCH', async () => {
    vi.mocked(api.patch).mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('button', { name: /Save Report Schedule/i });
    await user.click(screen.getByRole('button', { name: /Save Report Schedule/i }));

    await waitFor(() => {
      expect(screen.queryByText('Failed to save report schedule')).toBeTruthy();
    });
  });
});
