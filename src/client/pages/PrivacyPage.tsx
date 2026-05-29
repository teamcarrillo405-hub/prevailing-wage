// src/client/pages/PrivacyPage.tsx
// Route: /privacy — public page, no auth required.

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

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <LegalNav />

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-white">
          <h1 className="font-headline text-4xl font-bold text-nav-dark mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 font-body mb-10">Effective: June 1, 2026</p>

          <div className="space-y-10 font-body text-gray-700 leading-relaxed">

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">1. Information We Collect</h2>
              <p>
                We collect account information you provide at registration (name, email address, company name),
                project and worker data you enter into the Service (including worker names, classifications, and
                Social Security Numbers), payroll records and wage entries, and usage logs such as page views,
                API calls, and feature interactions. We do not collect payment card data directly — all billing
                is handled by Stripe.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">2. How We Use Information</h2>
              <p>
                We use the information we collect to provide and operate the Service, including generating
                certified payroll reports and enforcing Davis-Bacon compliance rules. We may use account and
                usage information to send compliance alerts, product update notifications, and customer support
                communications. We also use aggregated, anonymized usage data to improve product features and
                performance over time.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">3. Data Sharing</h2>
              <p>
                We do not sell, rent, or trade your data to third parties. We share data only with service
                providers necessary to operate the platform: Stripe processes all subscription billing and
                stores payment method details; Resend handles transactional email delivery such as invitation
                and alert messages. Both providers are contractually required to protect your data and use it
                only for the purposes described.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">4. Data Security</h2>
              <p>
                All worker Social Security Numbers and other sensitive payroll fields are encrypted at rest
                using AES-256-GCM encryption before being written to the database. Data in transit is protected
                by TLS 1.2 or higher on all connections. Our infrastructure follows SOC 2 Type II security
                controls, including access logging, least-privilege IAM policies, and regular vulnerability
                scanning.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">5. Data Retention</h2>
              <p>
                Project records, payroll entries, and worker data are retained for a minimum of three years
                following the completion of a covered contract, in accordance with 29 CFR Part 3 (Copeland
                Anti-Kickback Act) recordkeeping requirements. After the retention period expires, data may be
                permanently deleted. You may request an export of your data at any time by contacting support.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">6. Your Rights</h2>
              <p>
                You have the right to access, correct, or request deletion of your personal data, subject to
                our legal retention obligations described above. To exercise any of these rights, please submit
                a written request to{' '}
                <a
                  href="mailto:support@averopw.com"
                  className="text-nav-dark underline underline-offset-2 hover:text-brand-gold transition-colors"
                >
                  support@averopw.com
                </a>
                . We will respond within 30 days of receiving a verified request.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-xl font-bold text-nav-dark mb-3">7. Contact</h2>
              <p>
                For questions or concerns about this Privacy Policy or our data practices, please contact us
                at{' '}
                <a
                  href="mailto:support@averopw.com"
                  className="text-nav-dark underline underline-offset-2 hover:text-brand-gold transition-colors"
                >
                  support@averopw.com
                </a>
                . We are committed to resolving privacy concerns promptly and transparently.
              </p>
            </section>

          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
