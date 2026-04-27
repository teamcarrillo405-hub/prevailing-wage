import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';

const schema = z.object({
  provider: z.enum(['okta', 'azure_ad', 'google_workspace', 'generic_saml']),
  domain: z.string().min(1, 'Domain is required').refine(v => v.includes('.'), {
    message: 'Must be a valid domain (e.g. acme.com)',
  }),
  idpEntityId: z.string().url('Must be a valid URL'),
  idpSsoUrl: z.string().url('Must be a valid URL'),
  idpCertificate: z.string().min(1, 'Certificate is required').refine(
    v => v.trim().startsWith('-----BEGIN CERTIFICATE-----'),
    { message: 'Must start with -----BEGIN CERTIFICATE-----' }
  ),
});

type FormValues = z.infer<typeof schema>;

type SaveStatus = 'idle' | 'saved' | 'error';

interface BillingStatus {
  planTier: 'starter' | 'pro' | 'enterprise';
}

export function SsoConfigPage() {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedConfigStatus, setSavedConfigStatus] = useState<'pending' | 'active' | 'disabled' | null>(null);

  const { data: billing } = useQuery<BillingStatus>({
    queryKey: ['billing-status'],
    queryFn: () =>
      fetch('/api/billing/status', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { planTier: 'starter' }),
  });

  const planTier = billing?.planTier ?? 'starter';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { provider: 'generic_saml' },
  });

  if (planTier !== 'enterprise') {
    return (
      <Layout>
        <PageHeader title="SAML SSO Configuration" />
        <Card>
          <h2 className="font-headline text-lg text-nav-dark mb-2">Enterprise Plan Required</h2>
          <p className="text-gray-600 mb-4">
            SAML Single Sign-On is available on the Enterprise plan. Upgrade to connect Okta, Azure AD,
            or any SAML 2.0 identity provider for your team.
          </p>
          <a href="/pricing">
            <Button variant="secondary">View Pricing</Button>
          </a>
        </Card>
      </Layout>
    );
  }

  async function onSubmit(values: FormValues) {
    try {
      setSaveStatus('idle');
      setErrorMessage('');
      await api.post('/sso/admin/config', values);
      setSaveStatus('saved');
      setSavedConfigStatus('pending');
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err?.message ?? 'Failed to save configuration. Please try again.');
    }
  }

  const inputClass =
    'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold';

  return (
    <Layout>
      <PageHeader title="SAML SSO Configuration" />

      <div className="space-y-6 max-w-2xl">
        {saveStatus === 'saved' && (
          <div className="bg-green-50 border border-green-200 rounded px-4 py-3 text-sm text-green-800">
            Configuration saved. Status: pending — test your connection before activating.
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline text-nav-dark text-lg">IdP Configuration</h2>
            {savedConfigStatus && (
              <Badge variant={savedConfigStatus === 'active' ? 'compliant' : savedConfigStatus === 'pending' ? 'warning' : 'neutral'}>
                {savedConfigStatus.charAt(0).toUpperCase() + savedConfigStatus.slice(1)}
              </Badge>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select {...register('provider')} className={inputClass}>
                <option value="okta">Okta</option>
                <option value="azure_ad">Azure AD</option>
                <option value="google_workspace">Google Workspace</option>
                <option value="generic_saml">Generic SAML</option>
              </select>
              {errors.provider && (
                <p className="mt-1 text-xs text-red-600">{errors.provider.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Domain</label>
              <input
                {...register('domain')}
                type="text"
                placeholder="acme.com"
                className={inputClass}
              />
              {errors.domain && (
                <p className="mt-1 text-xs text-red-600">{errors.domain.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IdP Entity ID</label>
              <input
                {...register('idpEntityId')}
                type="text"
                placeholder="https://dev-12345.okta.com"
                className={inputClass}
              />
              {errors.idpEntityId && (
                <p className="mt-1 text-xs text-red-600">{errors.idpEntityId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IdP SSO URL</label>
              <input
                {...register('idpSsoUrl')}
                type="text"
                placeholder="https://dev-12345.okta.com/app/prevailingwage/sso/saml"
                className={inputClass}
              />
              {errors.idpSsoUrl && (
                <p className="mt-1 text-xs text-red-600">{errors.idpSsoUrl.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IdP Certificate</label>
              <textarea
                {...register('idpCertificate')}
                placeholder={`-----BEGIN CERTIFICATE-----\nMIIC...base64...\n-----END CERTIFICATE-----`}
                rows={8}
                className={`${inputClass} font-mono text-xs`}
              />
              {errors.idpCertificate && (
                <p className="mt-1 text-xs text-red-600">{errors.idpCertificate.message}</p>
              )}
            </div>

            <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </Button>
          </form>
        </Card>

        {saveStatus === 'saved' && (
          <Card>
            <h3 className="font-headline text-nav-dark mb-3">SP Metadata</h3>
            <p className="text-sm text-gray-600 mb-3">
              Share this URL with your IdP as the SP metadata URL:
            </p>
            <code className="block bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono text-gray-800 mb-3 break-all">
              {window.location.origin}/api/sso/metadata
            </code>
            <a
              href="/api/sso/metadata"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm">View SP Metadata XML</Button>
            </a>
          </Card>
        )}
      </div>
    </Layout>
  );
}
