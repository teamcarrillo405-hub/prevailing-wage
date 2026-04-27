/**
 * Tests for RoiCalculatorPage — pure calcRoi() unit tests + interaction tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { calcRoi, RoiCalculatorPage } from './RoiCalculatorPage';

// ── calcRoi unit tests ────────────────────────────────────────────────────────

describe('calcRoi()', () => {
  it('calculates correctly for 10 workers', () => {
    const result = calcRoi(1, 10);
    expect(result.annualHours).toBe(1300); // 10 * 2.5 * 52
    expect(result.annualSavings).toBe(58500); // 1300 * 45
  });

  it('calculates correctly for 50 workers', () => {
    const result = calcRoi(5, 50);
    expect(result.annualHours).toBe(6500); // 50 * 2.5 * 52
    expect(result.annualSavings).toBe(292500); // 6500 * 45
  });

  it('calculates correctly for 1 worker', () => {
    const result = calcRoi(1, 1);
    expect(result.annualHours).toBe(130); // 1 * 2.5 * 52
    expect(result.annualSavings).toBe(5850); // 130 * 45
  });

  it('calculates correctly for 200 workers', () => {
    const result = calcRoi(50, 200);
    expect(result.annualHours).toBe(26000); // 200 * 2.5 * 52
    expect(result.annualSavings).toBe(1170000); // 26000 * 45
  });

  it('project count does not affect the formula', () => {
    const r1 = calcRoi(1, 20);
    const r2 = calcRoi(50, 20);
    expect(r1.annualHours).toBe(r2.annualHours);
    expect(r1.annualSavings).toBe(r2.annualSavings);
  });
});

// ── Component interaction tests ───────────────────────────────────────────────

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/roi${search}`]}>
      <RoiCalculatorPage />
    </MemoryRouter>
  );
}

describe('RoiCalculatorPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the page heading', () => {
    renderPage();
    expect(screen.getByText(/Calculate Your ROI/i)).toBeInTheDocument();
  });

  it('shows default savings on load (5 projects, 20 workers)', () => {
    renderPage();
    // 20 * 2.5 * 52 = 2600 hours, * 45 = $117,000
    expect(screen.getByText(/2,600/)).toBeInTheDocument();
    expect(screen.getByText(/117,000/)).toBeInTheDocument();
  });

  it('updates savings when workers slider changes', () => {
    renderPage();
    const sliders = screen.getAllByRole('slider');
    // workers slider is the second one
    const workersSlider = sliders[1];
    fireEvent.change(workersSlider, { target: { value: '50' } });
    // 50 * 2.5 * 52 = 6500 hours, * 45 = $292,500
    expect(screen.getByText(/6,500/)).toBeInTheDocument();
    expect(screen.getByText(/292,500/)).toBeInTheDocument();
  });

  it('pre-fills sliders from URL params', () => {
    renderPage('?projects=10&workers=50');
    // 50 * 2.5 * 52 = 6500 hours
    expect(screen.getByText(/6,500/)).toBeInTheDocument();
  });

  it('clamps URL params to slider range', () => {
    renderPage('?projects=999&workers=999');
    // clamped: workers = 200, 200 * 2.5 * 52 = 26000 hours
    expect(screen.getByText(/26,000/)).toBeInTheDocument();
  });

  it('shows submit button as disabled when email is empty', () => {
    renderPage();
    const button = screen.getByRole('button', { name: /Send My Free Report/i });
    expect(button).toBeDisabled();
  });

  it('enables submit button when email is filled', () => {
    renderPage();
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    const button = screen.getByRole('button', { name: /Send My Free Report/i });
    expect(button).not.toBeDisabled();
  });

  it('shows sending state on submit and success on 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'abc', email: 'test@example.com' }),
    }));
    renderPage();
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    const button = screen.getByRole('button', { name: /Send My Free Report/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/Report sent/i)).toBeInTheDocument();
    });
  });

  it('shows error message on failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Server error',
    }));
    renderPage();
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    const button = screen.getByRole('button', { name: /Send My Free Report/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });

  it('POSTs to /api/roi-leads with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'abc' }),
    });
    vi.stubGlobal('fetch', mockFetch);
    renderPage();
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    fireEvent.change(emailInput, { target: { value: 'lead@test.com' } });
    const button = screen.getByRole('button', { name: /Send My Free Report/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/roi-leads',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.email).toBe('lead@test.com');
      expect(typeof body.estimatedSavings).toBe('number');
    });
  });
});
