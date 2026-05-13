// src/client/pages/ContactPage.tsx
// Route: /contact — public, no auth required.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Clock, Shield } from 'lucide-react';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming', 'Multiple states',
];

interface FormState {
  name: string;
  company: string;
  email: string;
  state: string;
  message: string;
}

export function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    company: '',
    email: '',
    state: '',
    message: '',
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const subject = encodeURIComponent(
      `PrevWage Inquiry — ${form.company || form.name} (${form.state || 'State not specified'})`
    );
    const body = encodeURIComponent(
      `Name: ${form.name}\nCompany: ${form.company}\nEmail: ${form.email}\nState: ${form.state}\n\nMessage:\n${form.message}`
    );
    window.location.href = `mailto:support@prevwage.com?subject=${subject}&body=${body}`;
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-nav-dark focus:border-transparent transition-shadow';

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm text-gray-300 hover:text-white transition-colors">
            <span className="font-semibold text-white">PrevWage</span>
          </Link>
          <Link
            to="/register"
            className="text-sm bg-brand-gold text-black font-semibold px-4 py-2 rounded-lg hover:bg-brand-gold/90 transition-colors"
          >
            Start Free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-nav-dark text-white pt-20 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold text-brand-gold uppercase tracking-widest mb-4">
            Talk to an Expert
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6 font-headline">
            Talk to a Prevailing Wage Expert
          </h1>
          <p className="text-xl text-gray-400 max-w-xl mx-auto">
            Questions about compliance, state coverage, pricing, or implementation?
            We respond to every inquiry within one business day.
          </p>
        </div>
      </div>

      {/* Trust strip */}
      <div className="bg-brand-gold py-6 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-8 text-center">
          {[
            { Icon: Clock, text: 'Response within 1 business day' },
            { Icon: Mail, text: 'Direct line to compliance team' },
            { Icon: Shield, text: 'No sales pressure — ever' },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-nav-dark text-sm font-medium">
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form + sidebar */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">

          {/* Form */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 font-headline">
              Send us a message
            </h2>
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                    Full name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Maria Gonzalez"
                    value={form.name}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="company" className="block text-sm font-semibold text-gray-700 mb-2">
                    Company
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    autoComplete="organization"
                    placeholder="Acme Construction Co."
                    value={form.company}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Work email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">
                  Which state(s) are you working in?
                </label>
                <select
                  id="state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="">Select a state...</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us about your project, current process, or specific compliance questions..."
                  value={form.message}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-nav-dark text-white font-semibold py-4 rounded-xl hover:bg-nav-dark/90 transition-colors text-sm"
              >
                Send message
              </button>
              <p className="text-xs text-gray-400 text-center">
                This opens your email client with your message pre-filled.
                We respond within one business day.
              </p>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                Common questions we answer
              </h3>
              <ul className="space-y-3 text-sm text-gray-600">
                {[
                  'Which states do you support natively?',
                  'How does WA L&I XML export work?',
                  'Can we import from QuickBooks or ADP?',
                  'How is SSN data encrypted and stored?',
                  'Do you support subcontractor portal submissions?',
                  'What does onboarding look like for a team?',
                ].map((q) => (
                  <li key={q} className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-gold flex-shrink-0" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Direct email</h3>
              <a
                href="mailto:support@prevwage.com"
                className="text-sm text-nav-dark font-medium hover:text-brand-gold transition-colors break-all"
              >
                support@prevwage.com
              </a>
              <p className="text-xs text-gray-500 mt-2">
                Mon–Fri, 8am–6pm PT
              </p>
            </div>

            <div className="bg-nav-dark rounded-xl p-6 text-white">
              <h3 className="text-sm font-bold mb-2">Ready to start?</h3>
              <p className="text-xs text-gray-400 mb-4">
                Set up your first project in under 10 minutes, free.
              </p>
              <Link
                to="/register"
                className="block text-center bg-brand-gold text-black font-semibold py-2.5 rounded-lg text-sm hover:bg-brand-gold/90 transition-colors"
              >
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 text-xs py-8 text-center">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center gap-6">
          <Link to="/case-studies" className="hover:text-gray-300 transition-colors">Case Studies</Link>
          <Link to="/api-docs" className="hover:text-gray-300 transition-colors">API Docs</Link>
          <Link to="/security" className="hover:text-gray-300 transition-colors">Security Policy</Link>
          <Link to="/register" className="hover:text-gray-300 transition-colors">Register</Link>
        </div>
        <p className="mt-6 text-gray-600">2026 PrevWage. All rights reserved.</p>
      </footer>
    </div>
  );
}
