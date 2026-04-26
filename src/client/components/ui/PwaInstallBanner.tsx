// MOB-15 — PWA Install Banner
// Shows a contextual prompt to install the app as a PWA.
// On Chromium: triggers the native beforeinstallprompt flow.
// On iOS Safari: explains the manual "Share → Add to Home Screen" flow.
// Dismissed permanently via localStorage.
import { usePwaInstall } from '../../hooks/usePwaInstall';

export function PwaInstallBanner() {
  const { canInstall, isIos, isDismissed, promptInstall, dismiss } = usePwaInstall();

  // Do not show if:
  // — dismissed by user
  // — neither native prompt available nor iOS
  if (isDismissed) return null;
  if (!canInstall && !isIos) return null;

  return (
    <div
      className="bg-brand-navy text-white px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-sm"
      role="banner"
      aria-label="Install PrevWage app"
    >
      <p className="flex-1 min-w-0">
        <span className="font-semibold">Install PrevWage</span>{' '}
        {isIos
          ? 'for offline field access — tap the Share button then "Add to Home Screen".'
          : 'for offline field access.'}
      </p>

      <div className="flex items-center gap-2 shrink-0">
        {!isIos && canInstall && (
          <button
            onClick={() => void promptInstall()}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-brand-gold text-nav-dark font-semibold text-sm hover:bg-brand-gold/90 transition-colors"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white transition-colors text-xl leading-none"
          aria-label="Dismiss install prompt"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
