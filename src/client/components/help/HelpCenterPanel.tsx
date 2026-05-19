import { useState, useMemo } from 'react';
import { X, Search, HelpCircle } from 'lucide-react';
import { GLOSSARY } from '../../lib/glossary';

interface Props { open: boolean; onClose: () => void; }

export function HelpCenterPanel({ open, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'start' | 'glossary' | 'faq'>('glossary');

  const filtered = useMemo(() =>
    GLOSSARY.filter(t => t.term.toLowerCase().includes(search.toLowerCase()) || t.definition.toLowerCase().includes(search.toLowerCase())),
    [search]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={onClose} />}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-nav-dark border-l border-surface-card shadow-2xl z-50 flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-surface-card">
          <h2 className="font-headline text-lg text-white flex items-center gap-2"><HelpCircle className="h-5 w-5 text-brand-gold" /> Help Center</h2>
          <button onClick={onClose} className="text-surface-muted hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-3 border-b border-surface-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search help..." className="w-full pl-9 pr-3 py-2 bg-surface-card rounded-lg text-sm text-white placeholder-surface-muted border border-surface-card focus:border-brand-gold outline-none" />
          </div>
        </div>
        <div className="flex border-b border-surface-card">
          {(['start','glossary','faq'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-xs font-medium capitalize ${tab === t ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-surface-muted'}`}>
              {t === 'start' ? 'Getting Started' : t === 'faq' ? 'FAQ' : 'Glossary'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'glossary' && (
            <div className="space-y-4">
              {filtered.map(g => (
                <div key={g.term} className="border-b border-surface-card pb-3">
                  <p className="font-medium text-white text-sm">{g.term}</p>
                  <p className="text-xs text-surface-muted mt-1 leading-relaxed">{g.definition}</p>
                  {g.related && <p className="text-xs text-brand-gold mt-1">See also: {g.related.join(', ')}</p>}
                </div>
              ))}
              {filtered.length === 0 && <p className="text-sm text-surface-muted">No results for &ldquo;{search}&rdquo;</p>}
            </div>
          )}
          {tab === 'start' && (
            <div className="space-y-3 text-sm text-surface-muted">
              <p className="font-medium text-white">Quick Start (4 steps)</p>
              {['Create a project with contract details and funding type','Add workers with their trade classifications','Enter weekly payroll hours and verify wage rates','Download the WH-347 certified payroll report'].map((s, i) => (
                <div key={i} className="flex gap-3"><span className="text-brand-gold font-bold">{i+1}.</span><span>{s}</span></div>
              ))}
            </div>
          )}
          {tab === 'faq' && (
            <div className="space-y-4 text-sm">
              {[
                { q: 'What is a certified payroll?', a: 'A weekly report (WH-347) submitted under penalty of perjury confirming workers were paid the prevailing wage.' },
                { q: 'How often do I submit?', a: 'Weekly, for each week any work was performed on a covered project.' },
                { q: 'Can I pay cash in lieu of fringe?', a: 'Yes. Cash fringe is added to the base rate on the paycheck. It counts toward the prevailing wage requirement.' },
                { q: 'What happens if I miss a week?', a: 'Submit a retroactive payroll. Note the late submission. DOL may assess back wages + interest if violations are found.' },
              ].map(f => (
                <div key={f.q} className="border-b border-surface-card pb-3">
                  <p className="font-medium text-white">{f.q}</p>
                  <p className="text-surface-muted mt-1">{f.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
