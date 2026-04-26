import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';

interface MfaChallengeProps {
  userId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

/**
 * Phase 78 — Second-factor challenge UI (SOC 2 SEC-02).
 * Renders a 6-digit auto-advance input by default, with a toggle to enter
 * an 8-character backup code. Posts to /api/auth/mfa-login via AuthContext.
 */
export function MfaChallenge({ userId, onSuccess, onCancel }: MfaChallengeProps) {
  const { completeMfaLogin } = useAuth();
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [backupCode, setBackupCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Auto-focus the first slot on mount / mode flip.
  useEffect(() => {
    if (mode === 'totp') inputs.current[0]?.focus();
  }, [mode]);

  function handleDigitChange(idx: number, raw: string) {
    setError(null);
    // Strip non-digits — handles paste of "123 456" too.
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[idx] = '';
      setDigits(next);
      return;
    }
    if (cleaned.length > 1) {
      // Paste: distribute across remaining slots.
      const next = [...digits];
      for (let i = 0; i < cleaned.length && idx + i < 6; i++) {
        next[idx + i] = cleaned[i] ?? '';
      }
      setDigits(next);
      const lastFilled = Math.min(idx + cleaned.length, 5);
      inputs.current[lastFilled]?.focus();
      // Auto-submit if fully populated by paste.
      if (next.every((d) => d !== '')) {
        void submit(next.join(''));
      }
      return;
    }
    const next = [...digits];
    next[idx] = cleaned;
    setDigits(next);
    if (idx < 5) inputs.current[idx + 1]?.focus();
    if (next.every((d) => d !== '') && idx === 5) {
      void submit(next.join(''));
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && digits[idx] === '' && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  async function submit(token: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeMfaLogin(userId, token);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      if (mode === 'totp') {
        setDigits(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitClick() {
    if (mode === 'totp') {
      const token = digits.join('');
      if (token.length !== 6) {
        setError('Enter all 6 digits');
        return;
      }
      void submit(token);
    } else {
      const cleaned = backupCode.replace(/\s+/g, '');
      if (cleaned.length < 6) {
        setError('Enter your backup code');
        return;
      }
      void submit(cleaned);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Two-factor authentication</h2>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'totp'
            ? 'Open your authenticator app and enter the 6-digit code.'
            : 'Enter one of the one-time backup codes you saved during setup.'}
        </p>
      </div>

      {mode === 'totp' ? (
        <div className="flex gap-2 justify-between" role="group" aria-label="Verification code">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={6} // allow paste; we trim above
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              aria-label={`Digit ${i + 1}`}
              className="w-10 h-12 text-center text-lg font-mono rounded-sm border border-gray-300 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold"
              disabled={submitting}
            />
          ))}
        </div>
      ) : (
        <input
          type="text"
          autoComplete="one-time-code"
          autoFocus
          value={backupCode}
          onChange={(e) => { setBackupCode(e.target.value); setError(null); }}
          aria-label="Backup code"
          placeholder="abcd1234"
          className="w-full px-3 py-2 text-sm font-mono rounded-sm border border-gray-300 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold"
          disabled={submitting}
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={handleSubmitClick} disabled={submitting} className="flex-1">
          {submitting ? 'Verifying…' : 'Verify'}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === 'totp' ? 'backup' : 'totp'));
          setError(null);
        }}
        className="text-xs text-gray-500 hover:text-gray-800 underline"
      >
        {mode === 'totp' ? 'Use a backup code instead' : 'Use authenticator app instead'}
      </button>
    </div>
  );
}
