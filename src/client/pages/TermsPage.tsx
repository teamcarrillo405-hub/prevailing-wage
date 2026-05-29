// src/client/pages/TermsPage.tsx
// Route: /terms — public page, no auth required.

import { Link } from 'react-router-dom';

function LegalNav() {
  return (
    <nav className="bg-nav-dark px-6 py-4 flex items-center justify-between">
      <Link to="/" className="inline-flex min-h-11 items-center text-brand-gold font-headline text-xl font-bold">
        AVERO Prevailing Wage
      </Link>
      <div className="flex items-center gap-6">
        <Link
          to="/login"
          className="inline-flex min-h-11 min-w-11 items-center text-white hover:text-brand-gold transition-colors text-sm font-medium"
        >
          Log In
        </Link>
        <Link
          to="/register"
          className="bg-brand-gold text-black font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          Get Started Free
        </Link>
      </div>
    </nav>
  );
}

function LegalFooter() {
  return (
    <footer className="bg-nav-dark text-gray-400 py-8 px-6 mt-16">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm">
        <p className="text-xs text-gray-600">&copy; 2026 AVERO Prevailing Wage. All rights reserved.</p>
        <div className="flex gap-6">
          <Link to="/terms" className="inline-flex min-h-11 items-center text-gray-400 hover:text-brand-gold transition-colors">Terms</Link>
          <Link to="/privacy" className="inline-flex min-h-11 items-center text-gray-400 hover:text-brand-gold transition-colors">Privacy</Link>
          <Link to="/security" className="inline-flex min-h-11 items-center text-gray-400 hover:text-brand-gold transition-colors">Security</Link>
          <Link to="/contact" className="inline-flex min-h-11 items-center text-gray-400 hover:text-brand-gold transition-colors">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <LegalNav />

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-white">
          <h1 className="font-headline text-4xl font-bold text-nav-dark mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500 font-body mb-10">Effective: June 1, 2026</p>

          <div className="space-y-10 font-body text-gray-700 leading-relaxed">

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using AVERO Prevailing Wage ("the Service"), you agree to be bound by these Terms
                of Service and all applicable laws and regulations. If you do not agree with any part of these terms,
                you may not use the Service. Your continued use of the Service following any modifications constitutes
                acceptance of those changes.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">2. Description of Service</h2>
              <p>
                AVERO Prevailing Wage is a cloud-based certified payroll compliance platform designed to assist
                federal construction contractors in meeting Davis-Bacon and Related Acts requirements. The Service
                automates the preparation of WH-347 forms, enforces apprentice ratio rules, and generates
                state-specific certified payroll reports for covered public works projects. It is intended as a
                compliance assistance tool and does not constitute legal advice.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">3. Account Registration</h2>
              <p>
                You must provide accurate, complete, and current information when creating an account, and you
                agree to keep that information up to date. You are solely responsible for maintaining the
                confidentiality of your login credentials and for all activity that occurs under your account.
                You must notify us immediately at support@averopw.com if you suspect any unauthorized use of
                your account.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">4. Subscription and Payment</h2>
              <p>
                Paid plans are billed on a monthly or annual basis through Stripe. You may cancel your subscription
                at any time from your billing settings, and cancellation takes effect at the end of the current
                billing period. We do not issue refunds for partial billing periods or unused features. Prices are
                subject to change with 30 days' notice.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">5. Prohibited Uses</h2>
              <p>
                You may not resell, sublicense, or redistribute access to the Service, or use automated tools to
                scrape or extract data from it. You may not use the Service for any unlawful purpose, and you may
                not submit falsified, fabricated, or knowingly inaccurate payroll data into the system. Violation
                of federal certified payroll requirements through misuse of this platform is solely your
                responsibility.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">6. Data and Privacy</h2>
              <p>
                We store project, worker, and payroll data you submit in order to provide the Service, including
                generating certified payroll reports and enforcing compliance rules. We handle sensitive data such
                as Social Security Numbers in accordance with our{' '}
                <Link to="/privacy" className="text-nav-dark underline underline-offset-2 hover:text-brand-gold transition-colors">
                  Privacy Policy
                </Link>
                . By using the Service, you consent to that data processing as described therein.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">7. Limitation of Liability</h2>
              <p>
                AVERO Prevailing Wage is a software tool designed to assist with compliance preparation; it does
                not guarantee the accuracy, completeness, or legal sufficiency of any certified payroll report or
                form submitted to a contracting agency. You remain solely responsible for reviewing, certifying,
                and submitting all payroll filings in accordance with applicable federal and state law. To the
                maximum extent permitted by law, our liability is limited to the amount you paid for the Service
                in the 12 months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">8. Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account if you violate these Terms, engage in
                fraudulent activity, or use the Service in a manner that could harm other users or the integrity
                of the platform. Following termination, your project and payroll records will be retained for
                three years as required by 29 CFR Part 3, after which they may be purged. You may request an
                export of your data prior to termination.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">9. Contact</h2>
              <p>
                For questions about these Terms of Service, please contact us at{' '}
                <a
                  href="mailto:support@averopw.com"
                  className="text-nav-dark underline underline-offset-2 hover:text-brand-gold transition-colors"
                >
                  support@averopw.com
                </a>
                . We aim to respond to all inquiries within two business days.
              </p>
            </section>

          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
