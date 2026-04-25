// src/client/components/illustrations/EmptyIllustrations.tsx
// SVG illustrations for empty state screens — UI-11 requirement

export function ProjectsEmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-60">
      <rect x="20" y="30" width="80" height="60" rx="6" fill="#E8EDF5" stroke="#94A3B8" strokeWidth="2"/>
      <rect x="30" y="42" width="40" height="4" rx="2" fill="#94A3B8"/>
      <rect x="30" y="52" width="55" height="4" rx="2" fill="#CBD5E1"/>
      <rect x="30" y="62" width="48" height="4" rx="2" fill="#CBD5E1"/>
      <circle cx="90" cy="35" r="14" fill="#1E3A5F"/>
      <path d="M90 29v6M90 35h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function WorkersEmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-60">
      <circle cx="60" cy="40" r="18" fill="#E8EDF5" stroke="#94A3B8" strokeWidth="2"/>
      <path d="M34 88c0-14.36 11.64-26 26-26h0c14.36 0 26 11.64 26 26" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="85" cy="45" r="10" fill="#1E3A5F"/>
      <path d="M85 40v5M85 45h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function PayrollEmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-60">
      <rect x="25" y="20" width="70" height="85" rx="5" fill="#E8EDF5" stroke="#94A3B8" strokeWidth="2"/>
      <rect x="35" y="35" width="50" height="3" rx="1.5" fill="#94A3B8"/>
      <rect x="35" y="44" width="35" height="3" rx="1.5" fill="#CBD5E1"/>
      <rect x="35" y="53" width="42" height="3" rx="1.5" fill="#CBD5E1"/>
      <rect x="35" y="62" width="28" height="3" rx="1.5" fill="#CBD5E1"/>
      <rect x="60" y="73" width="25" height="18" rx="3" fill="#1E3A5F"/>
      <path d="M68 82l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function ReportsEmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-60">
      <rect x="20" y="25" width="80" height="70" rx="5" fill="#E8EDF5" stroke="#94A3B8" strokeWidth="2"/>
      <rect x="30" y="50" width="12" height="30" rx="2" fill="#94A3B8"/>
      <rect x="48" y="40" width="12" height="40" rx="2" fill="#1E3A5F" opacity="0.5"/>
      <rect x="66" y="55" width="12" height="25" rx="2" fill="#94A3B8"/>
      <rect x="84" y="45" width="8" height="35" rx="2" fill="#DEB400" opacity="0.7"/>
    </svg>
  );
}

export function ActivityEmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-60">
      <circle cx="60" cy="60" r="35" fill="#E8EDF5" stroke="#94A3B8" strokeWidth="2"/>
      <path d="M60 42v20l12 8" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
