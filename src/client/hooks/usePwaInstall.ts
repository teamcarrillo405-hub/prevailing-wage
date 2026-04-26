// MOB-15 — PWA install prompt hook
// Captures the browser's `beforeinstallprompt` event so we can show a
// custom install banner at the right moment. Works on Chromium browsers.
// On iOS, the event never fires — the banner falls back to a "Add to Home
// Screen" instruction instead.
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface UsePwaInstallReturn {
  /** True when the native install prompt is available (Chromium only). */
  canInstall: boolean;
  /** True on iOS Safari where the Add-to-Home-Screen UI must be shown instead. */
  isIos: boolean;
  /** Whether the banner has been permanently dismissed by the user. */
  isDismissed: boolean;
  /** Trigger the native install prompt (no-op on iOS). */
  promptInstall: () => Promise<void>;
  /** Persist the dismissal and hide the banner. */
  dismiss: () => void;
}

const STORAGE_KEY = 'pwa-install-dismissed';

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function usePwaInstall(): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  );

  const isIos = detectIos();
  const canInstall = deferredPrompt !== null;

  useEffect(() => {
    // Already installed — no need to capture the prompt
    if (isStandaloneMode()) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function promptInstall(): Promise<void> {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      // Clear prompt so banner disappears after install
      setDeferredPrompt(null);
      dismiss();
    }
  }

  function dismiss(): void {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsDismissed(true);
  }

  return { canInstall, isIos, isDismissed, promptInstall, dismiss };
}
