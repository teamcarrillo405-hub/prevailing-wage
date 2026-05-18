import { FormEvent, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Loader2, MessageSquare, Send, ShieldCheck, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

type CopilotSuggestion = {
  id: string;
  title: string;
  description: string;
  actionType: 'review' | 'navigate' | 'prepare_fix' | 'none';
  target?: string;
};

type CopilotCitation = {
  id: string;
  label: string;
  source: 'project' | 'wage_determination' | 'payroll_week' | 'compliance' | 'import' | 'onboarding' | 'export';
  detail: string;
};

type CopilotReadinessItem = {
  id: string;
  label: string;
  status: 'complete' | 'warning' | 'blocked' | 'not_started';
  detail: string;
  actionId?: string;
};

type CopilotStateSnapshot = {
  projectId: string | null;
  payrollWeekId: string | null;
  readinessScore: number;
  readinessStatus: 'setup_incomplete' | 'wd_missing' | 'payroll_empty' | 'violations_blocking' | 'ready_for_review' | 'ready_to_export' | 'filed_or_archived';
  headline: string;
  items: CopilotReadinessItem[];
  citations: CopilotCitation[];
  suggestedActions: CopilotSuggestion[];
};

type CopilotResponse = {
  answer: string;
  nextSteps: string[];
  warnings: string[];
  suggestions: CopilotSuggestion[];
  citations: CopilotCitation[];
  readiness?: CopilotStateSnapshot;
  confidence: number;
  modelUsed: string;
};

type CopilotApiResponse = {
  data: CopilotResponse;
};

type CopilotPreparedAction = {
  id: string;
  actionId: string;
  status: 'draft_review' | 'reviewed' | 'rejected';
  title: string;
  summary: string;
  findings: string[];
  proposedSteps: string[];
  warnings: string[];
  approvalRequired: boolean;
  applySupported: boolean;
  applyLabel?: string;
  targetRoute?: string;
};

type CopilotPreparedActionResponse = {
  data: CopilotPreparedAction;
};

type CopilotApplyResponse = {
  data: {
    applied: boolean;
    message: string;
    readiness: CopilotStateSnapshot;
  };
};

type VisibleField = {
  label: string;
  name?: string;
  type?: string;
  value: string;
};

type PageContext = {
  pageLabel?: string;
  routeKind?: string;
  sectionLabel?: string;
  hash?: string;
  visibleHeadings?: string[];
  primaryActions?: string[];
  alerts?: string[];
};

type ChatMessage =
  | {
      role: 'assistant';
      text: string;
      nextSteps?: string[];
      warnings?: string[];
      suggestions?: CopilotSuggestion[];
      citations?: CopilotCitation[];
      preparedAction?: CopilotPreparedAction;
    }
  | { role: 'user'; text: string };

const SENSITIVE_FIELD = /(ssn|social|password|secret|token|key|bank|routing|account)/i;

const READINESS_LABELS: Record<CopilotStateSnapshot['readinessStatus'], string> = {
  setup_incomplete: 'Setup incomplete',
  wd_missing: 'WD missing',
  payroll_empty: 'Payroll empty',
  violations_blocking: 'Violations blocking',
  ready_for_review: 'Ready for review',
  ready_to_export: 'Ready to export',
  filed_or_archived: 'Filed or archived',
};

const STATUS_CLASS: Record<CopilotReadinessItem['status'], string> = {
  complete: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  blocked: 'bg-red-50 text-red-800 border-red-200',
  not_started: 'bg-gray-100 text-gray-700 border-gray-200',
};

function getRouteIds(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const projectIndex = segments.indexOf('projects');
  const payrollIndex = segments.indexOf('payroll');

  return {
    projectId: projectIndex >= 0 ? segments[projectIndex + 1] : undefined,
    payrollWeekId: payrollIndex >= 0 ? segments[payrollIndex + 1] : undefined,
  };
}

function inferPageContext(pathname: string, hash: string): Pick<PageContext, 'pageLabel' | 'routeKind' | 'sectionLabel'> {
  const segments = pathname.split('/').filter(Boolean);
  const sectionByHash: Record<string, string> = {
    '#wage-determinations': 'Wage determinations',
  };

  if (pathname === '/dashboard') return { pageLabel: 'Dashboard', routeKind: 'dashboard' };
  if (pathname === '/wages') return { pageLabel: 'Prevailing Wage Lookup', routeKind: 'wage_lookup' };
  if (pathname === '/workers') return { pageLabel: 'Workers', routeKind: 'workers' };
  if (pathname === '/payroll') return { pageLabel: 'Payroll list', routeKind: 'payroll_list' };
  if (pathname === '/onboarding') return { pageLabel: 'Onboarding', routeKind: 'onboarding' };
  if (pathname === '/integrations') return { pageLabel: 'Integrations', routeKind: 'integrations' };
  if (segments[0] === 'projects' && segments[2] === 'payroll' && segments[3] === 'new') {
    return { pageLabel: 'New payroll week', routeKind: 'payroll_new' };
  }
  if (segments[0] === 'projects' && segments[2] === 'payroll' && segments[3]) {
    return { pageLabel: 'Payroll week detail', routeKind: 'payroll_week_detail' };
  }
  if (segments[0] === 'projects' && segments[2] === 'workers') {
    return { pageLabel: 'Project workers', routeKind: 'project_workers' };
  }
  if (segments[0] === 'projects' && segments[2] === 'settings') {
    return { pageLabel: 'Project settings', routeKind: 'project_settings' };
  }
  if (segments[0] === 'projects' && segments[2] === 'field') {
    return { pageLabel: 'Field clock', routeKind: 'field_clock' };
  }
  if (segments[0] === 'projects') {
    return {
      pageLabel: 'Project detail',
      routeKind: 'project_detail',
      sectionLabel: sectionByHash[hash],
    };
  }
  return { pageLabel: document.title || 'Application page', routeKind: 'unknown' };
}

function findLabel(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (el.id) {
    const direct = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
    if (direct?.textContent) return direct.textContent.trim();
  }

  const wrapped = el.closest('label');
  if (wrapped?.textContent) return wrapped.textContent.trim();

  return el.getAttribute('aria-label') || el.name || el.placeholder || 'Field';
}

function collectVisibleFields(): VisibleField[] {
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, select, textarea',
    ),
  );

  return controls
    .filter((el) => {
      const style = window.getComputedStyle(el);
      const type = 'type' in el ? el.type : undefined;
      return (
        el.offsetParent !== null &&
        style.visibility !== 'hidden' &&
        type !== 'hidden' &&
        type !== 'password'
      );
    })
    .map((el) => ({
      label: findLabel(el).slice(0, 80),
      name: el.name || undefined,
      type: 'type' in el ? el.type : el.tagName.toLowerCase(),
      value: ('value' in el ? el.value : '').slice(0, 160),
    }))
    .filter((field) => field.value && !SENSITIVE_FIELD.test(`${field.label} ${field.name ?? ''} ${field.type ?? ''}`))
    .slice(0, 40);
}

function collectPageContext(pathname: string, hash: string): PageContext {
  const inferred = inferPageContext(pathname, hash);
  const isVisible = (el: HTMLElement) => {
    const style = window.getComputedStyle(el);
    return el.offsetParent !== null && style.visibility !== 'hidden';
  };
  const textOf = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text);
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3'))
    .filter(isVisible)
    .map(textOf)
    .filter(Boolean)
    .map((text) => clip(text, 140))
    .slice(0, 10);
  const actions = Array.from(document.querySelectorAll<HTMLElement>('button, a[href]'))
    .filter(isVisible)
    .map((el) => el.getAttribute('aria-label') || textOf(el))
    .filter(Boolean)
    .map((text) => clip(text, 120))
    .slice(0, 10);
  const alerts = Array.from(document.querySelectorAll<HTMLElement>('[role="alert"], .bg-red-50, .bg-amber-50, .bg-yellow-50, .bg-blue-50'))
    .filter(isVisible)
    .map(textOf)
    .filter(Boolean)
    .map((text) => clip(text, 240))
    .slice(0, 8);

  return {
    ...inferred,
    hash: hash || undefined,
    visibleHeadings: headings,
    primaryActions: actions,
    alerts,
  };
}

function getPagePlaybook(pathname: string, hash: string): string[] {
  const context = inferPageContext(pathname, hash);
  switch (context.routeKind) {
    case 'dashboard':
      return ['What should I fix today?', 'Which project is closest to submit-ready?', 'Find missing payroll or subcontractor CPR items.'];
    case 'project_detail':
      return context.sectionLabel === 'Wage determinations'
        ? ['Explain this project wage source.', 'What should I confirm before payroll?', 'Help me lock the correct WD.']
        : ['What is this project missing?', 'What is the next contractor step?', 'Review evidence and payroll readiness.'];
    case 'project_workers':
      return ['Find workers missing classifications.', 'Explain base and fringe rates.', 'Check apprentice setup risks.'];
    case 'payroll_week_detail':
      return ['Explain blockers on this payroll week.', 'Find zero or missing rates.', 'Can I export certified payroll yet?'];
    case 'payroll_new':
      return ['Help create this payroll week.', 'Check imported workers and classifications.', 'Explain what rates will be used.'];
    case 'wage_lookup':
      return ['What WD number should I use?', 'Explain this wage determination.', 'How do I send this WD to my project?'];
    case 'field_clock':
      return ['Explain missed punch corrections.', 'What field evidence is missing?', 'How does GPS proof help payroll?'];
    case 'project_settings':
      return ['What settings affect certified payroll?', 'Find missing WD/project fields.', 'Explain field clock settings.'];
    default:
      return ['Review this page.', 'What should I do next?', 'Explain any visible blockers.'];
  }
}

export function CopilotWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [readiness, setReadiness] = useState<CopilotStateSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Ask me to review the page, explain a wage issue, check missing setup, or suggest the next payroll step.',
      warnings: ['AI-assisted guidance. Review before filing certified payroll.'],
    },
  ]);

  const routeIds = useMemo(() => getRouteIds(location.pathname), [location.pathname]);
  const pagePlaybook = useMemo(
    () => getPagePlaybook(location.pathname, location.hash),
    [location.pathname, location.hash],
  );
  const readinessLabel = readiness?.projectId ? 'Project readiness' : 'Page guidance';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setInput('');
    setMessages((current) => [...current, { role: 'user', text: message }]);
    setLoading(true);

    try {
      const response = await api.post<CopilotApiResponse>('/copilot/chat', {
        message,
        pagePath: `${location.pathname}${location.search}`,
        projectId: routeIds.projectId,
        payrollWeekId: routeIds.payrollWeekId,
        visibleFields: collectVisibleFields(),
        pageContext: collectPageContext(location.pathname, location.hash),
      });

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: response.data.answer,
          nextSteps: response.data.nextSteps,
          warnings: response.data.warnings,
          suggestions: response.data.suggestions,
          citations: response.data.citations,
        },
      ]);
      if (response.data.readiness) setReadiness(response.data.readiness);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Copilot is unavailable right now.';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text,
          warnings: ['Try again after saving the current page or refreshing your session.'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSuggestion(suggestion: CopilotSuggestion) {
    if (suggestion.actionType === 'navigate' && suggestion.target) {
      navigate(suggestion.target);
      setOpen(false);
      return;
    }

    if (suggestion.actionType !== 'prepare_fix' && suggestion.actionType !== 'review') return;

    setMessages((current) => [...current, { role: 'user', text: suggestion.title }]);
    setLoading(true);

    try {
      const response = await api.post<CopilotPreparedActionResponse>('/copilot/actions/prepare', {
        actionId: suggestion.id,
        pagePath: `${location.pathname}${location.search}`,
        projectId: routeIds.projectId,
        payrollWeekId: routeIds.payrollWeekId,
        visibleFields: collectVisibleFields(),
        pageContext: collectPageContext(location.pathname, location.hash),
      });

      const action = response.data;
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: action.summary,
          preparedAction: action,
          citations: readiness?.citations,
          suggestions: action.targetRoute
            ? [{
                id: `navigate-${action.targetRoute}`,
                title: 'Open target page',
                description: 'Go to the page related to this prepared review plan.',
                actionType: 'navigate',
                target: action.targetRoute,
              }]
            : undefined,
        },
      ]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to prepare this action.';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text,
          warnings: ['Nothing was changed. Try again after saving the current page.'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgeAction(action: CopilotPreparedAction, decision: 'reviewed' | 'rejected') {
    setLoading(true);

    try {
      const response = await api.post<{ data: { status: 'reviewed' | 'rejected'; message: string } }>(
        '/copilot/actions/acknowledge',
        {
          actionId: action.actionId,
          title: action.title,
          decision,
          pagePath: `${location.pathname}${location.search}`,
          projectId: routeIds.projectId,
          payrollWeekId: routeIds.payrollWeekId,
          pageContext: collectPageContext(location.pathname, location.hash),
        },
      );

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: response.data.message,
          warnings: ['Acknowledgement recorded in Copilot audit history.'],
        },
      ]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to record this decision.';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text,
          warnings: ['No action decision was recorded.'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: CopilotPreparedAction) {
    setLoading(true);

    try {
      const response = await api.post<CopilotApplyResponse>('/copilot/actions/apply', {
        actionId: action.actionId,
        confirm: true,
        pagePath: `${location.pathname}${location.search}`,
        projectId: routeIds.projectId,
        payrollWeekId: routeIds.payrollWeekId,
        pageContext: collectPageContext(location.pathname, location.hash),
      });

      setReadiness(response.data.readiness);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: response.data.message,
          warnings: ['Approved mutation recorded in Copilot audit history. Review the project before certified payroll export.'],
          citations: response.data.readiness.citations,
        },
      ]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to apply this action.';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text,
          warnings: ['No payroll, WD, classification, or filing data was changed.'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-5 sm:right-5">
      {open && (
        <section
          className="mb-3 flex h-[min(620px,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
          aria-label="PrevWage Copilot"
        >
          <header className="flex items-center justify-between border-b border-gray-200 bg-nav-dark px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-brand-gold" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold leading-tight">PrevWage Copilot</h2>
                <p className="text-xs text-gray-300">Compliance guidance with audit history</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-gray-300 hover:bg-white/10 hover:text-white"
              aria-label="Close Copilot"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-3">
            {readiness && (
              <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{readinessLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {readiness.headline}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold leading-none text-nav-dark">{readiness.readinessScore}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">score</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-xs text-gray-700">
                    {READINESS_LABELS[readiness.readinessStatus]}
                  </span>
                  {readiness.items.slice(0, 4).map((item) => (
                    <span
                      key={item.id}
                      className={`rounded-md border px-2 py-1 text-xs ${STATUS_CLASS[item.status]}`}
                      title={item.detail}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>

                {readiness.suggestedActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {readiness.suggestedActions.slice(0, 3).map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion.id}
                        onClick={() => handleSuggestion(suggestion)}
                        disabled={loading}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-left text-xs text-gray-700 transition-colors hover:border-brand-gold hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {suggestion.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">What I can help with here</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pagePlaybook.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-left text-xs text-gray-700 transition-colors hover:border-brand-gold hover:bg-brand-gold/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={message.role === 'user' ? 'ml-8 rounded-lg bg-nav-dark px-3 py-2 text-sm text-white' : 'mr-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800'}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>

                {message.preparedAction && (
                  <div className="mt-3 overflow-hidden rounded-md border border-gray-200 bg-white">
                    <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Human approval required
                          </p>
                          <h3 className="mt-0.5 text-sm font-semibold text-gray-900">{message.preparedAction.title}</h3>
                        </div>
                        <ShieldCheck className="h-5 w-5 shrink-0 text-brand-gold" aria-hidden="true" />
                      </div>
                    </div>

                    {message.preparedAction.findings.length > 0 && (
                      <div className="border-b border-gray-100 px-3 py-2">
                        <p className="text-xs font-semibold text-gray-700">Findings</p>
                        <ul className="mt-1 space-y-1 text-xs text-gray-600">
                          {message.preparedAction.findings.map((finding) => (
                            <li key={finding} className="leading-relaxed">- {finding}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {message.preparedAction.proposedSteps.length > 0 && (
                      <div className="border-b border-gray-100 px-3 py-2">
                        <p className="text-xs font-semibold text-gray-700">Proposed review steps</p>
                        <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-gray-600">
                          {message.preparedAction.proposedSteps.map((step) => (
                            <li key={step} className="leading-relaxed">{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {message.preparedAction.warnings.length > 0 && (
                      <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {message.preparedAction.warnings.map((warning) => (
                          <p key={warning} className="leading-relaxed">{warning}</p>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 px-3 py-2">
                      {message.preparedAction.applySupported && (
                        <button
                          type="button"
                          onClick={() => applyAction(message.preparedAction!)}
                          disabled={loading}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-brand-gold px-2.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          {message.preparedAction.applyLabel ?? 'Apply approved action'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => acknowledgeAction(message.preparedAction!, 'reviewed')}
                        disabled={loading}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-nav-dark px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-nav-dark/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Mark reviewed
                      </button>
                      <button
                        type="button"
                        onClick={() => acknowledgeAction(message.preparedAction!, 'rejected')}
                        disabled={loading}
                        className="min-h-[36px] rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject plan
                      </button>
                    </div>
                  </div>
                )}

                {message.warnings && message.warnings.length > 0 && (
                  <div className="mt-2 space-y-1 border-l-2 border-amber-400 pl-2 text-xs text-amber-800">
                    {message.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}

                {message.citations && message.citations.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <p className="text-xs font-semibold text-gray-500">Sources used</p>
                    <div className="mt-1 space-y-1">
                      {message.citations.slice(0, 4).map((citation) => (
                        <p key={citation.id} className="text-xs leading-relaxed text-gray-600">
                          <span className="font-medium text-gray-700">{citation.label}:</span> {citation.detail}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {message.nextSteps && message.nextSteps.length > 0 && (
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-gray-600">
                    {message.nextSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}

                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.suggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion.id}
                        onClick={() => handleSuggestion(suggestion)}
                        disabled={loading || suggestion.actionType === 'none'}
                        className="rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-left text-xs text-gray-700 transition-colors hover:border-brand-gold hover:bg-brand-gold/10 disabled:cursor-default disabled:hover:border-gray-200 disabled:hover:bg-gray-100"
                        title={suggestion.description}
                      >
                        {suggestion.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="mr-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Reviewing this page
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="copilot-message">Message Copilot</label>
              <textarea
                id="copilot-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                maxLength={900}
                placeholder="Review this page for wage or payroll issues..."
                className="min-h-[44px] flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-gold text-black transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold text-black shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2"
        aria-label={open ? 'Hide PrevWage Copilot' : 'Open PrevWage Copilot'}
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageSquare className="h-6 w-6" aria-hidden="true" />}
      </button>
    </div>
  );
}
