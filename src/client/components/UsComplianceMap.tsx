import { useState } from 'react';

// States with state-specific certified payroll forms (not just WH-347)
const STATE_CPR_FORMS: Record<string, string> = {
  CA: 'CA DIR A-1-131',
  WA: 'WA L&I F700-065-000',
  NY: 'NY DOL PW-12',
  IL: 'IL IDOL Certified Transcript',
  MA: 'MA DLS Payroll Report',
  NJ: 'NJ DOL MW-562',
  MN: 'MN DLI Certified Payroll',
  VA: 'VA DOLI Certified Payroll',
  PA: 'PA L&I PWC-28',
  OH: 'OH BWC PWC-28',
  CO: 'CO CDLE Certified Payroll',
  MD: 'MD DLLR Certified Payroll',
  OR: 'OR BOLI Certified Payroll',
  CT: 'CT DOL Certified Payroll',
  HI: 'HI DLIR Certified Payroll',
  KY: 'KY Labor Certified Payroll',
  NM: 'NM DOL Certified Payroll',
  NV: 'NV OSHA Certified Payroll',
  RI: 'RI DOL Certified Payroll',
  WV: 'WV DOL Certified Payroll',
  ME: 'ME DOL Certified Payroll',
  VT: 'VT DOL Certified Payroll',
  MT: 'MT DOL Certified Payroll',
  ND: 'ND DOL Certified Payroll',
  DE: 'DE DOL Certified Payroll',
  NH: 'NH DOL Certified Payroll',
  AK: 'AK DOL Certified Payroll',
};

// States with no state PW law — federal WH-347 is the required form
const FEDERAL_ONLY_STATES = new Set([
  'TX', 'FL', 'AL', 'AR', 'AZ', 'GA', 'IA', 'ID', 'IN',
  'KS', 'LA', 'MI', 'MO', 'MS', 'NC', 'NE', 'OK', 'SC',
  'SD', 'TN', 'UT', 'WI', 'WY',
]);

// State abbreviation to full name
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

// Simplified grid-aligned US state paths in 960x600 viewBox (Albers-approximate positions)
// Each state is a polygon approximating its geographic footprint and position
const STATE_PATHS: { abbr: string; d: string }[] = [
  // Northwest
  { abbr: 'WA', d: 'M 70 55 L 175 55 L 175 110 L 100 110 L 85 130 L 70 130 Z' },
  { abbr: 'OR', d: 'M 70 130 L 85 130 L 100 110 L 175 110 L 175 195 L 70 195 Z' },
  { abbr: 'CA', d: 'M 70 195 L 175 195 L 185 240 L 175 310 L 145 360 L 120 390 L 75 350 L 70 280 Z' },
  { abbr: 'ID', d: 'M 175 55 L 240 60 L 245 130 L 220 155 L 200 160 L 175 195 L 175 110 Z' },
  { abbr: 'NV', d: 'M 175 195 L 200 160 L 220 155 L 240 200 L 235 310 L 185 310 L 175 280 Z' },
  { abbr: 'MT', d: 'M 240 60 L 380 55 L 385 145 L 245 145 L 240 130 Z' },
  { abbr: 'WY', d: 'M 245 145 L 385 145 L 385 225 L 245 225 Z' },
  { abbr: 'UT', d: 'M 235 225 L 310 225 L 310 310 L 235 310 Z' },
  { abbr: 'CO', d: 'M 310 225 L 430 225 L 430 305 L 310 305 Z' },
  { abbr: 'AZ', d: 'M 185 310 L 310 310 L 310 400 L 240 410 L 180 390 Z' },
  { abbr: 'NM', d: 'M 310 305 L 430 305 L 430 390 L 310 390 Z' },
  // Plains
  { abbr: 'ND', d: 'M 385 55 L 500 55 L 500 140 L 385 145 Z' },
  { abbr: 'SD', d: 'M 385 145 L 500 140 L 502 225 L 385 225 Z' },
  { abbr: 'NE', d: 'M 385 225 L 502 225 L 505 295 L 430 295 L 430 265 L 385 265 Z' },
  { abbr: 'KS', d: 'M 385 295 L 430 295 L 510 295 L 510 360 L 385 360 Z' },
  { abbr: 'OK', d: 'M 385 360 L 510 360 L 520 365 L 520 420 L 430 420 L 385 415 Z' },
  { abbr: 'TX', d: 'M 385 415 L 430 420 L 520 420 L 530 425 L 540 490 L 500 530 L 440 540 L 390 510 L 370 480 L 365 440 Z' },
  { abbr: 'MN', d: 'M 500 55 L 595 55 L 600 65 L 590 100 L 595 140 L 560 150 L 500 140 Z' },
  { abbr: 'IA', d: 'M 502 225 L 595 220 L 598 285 L 505 290 Z' },
  { abbr: 'MO', d: 'M 505 290 L 598 285 L 600 360 L 570 370 L 510 360 L 510 320 Z' },
  { abbr: 'AR', d: 'M 510 360 L 570 370 L 600 370 L 605 435 L 510 435 L 510 400 Z' },
  { abbr: 'LA', d: 'M 510 435 L 605 435 L 608 490 L 580 510 L 540 500 L 510 490 Z' },
  // Great Lakes
  { abbr: 'WI', d: 'M 560 150 L 595 140 L 610 155 L 615 200 L 595 220 L 560 210 Z' },
  { abbr: 'IL', d: 'M 568 220 L 595 220 L 598 285 L 595 310 L 565 315 L 560 270 Z' },
  { abbr: 'MI', d: 'M 610 100 L 660 95 L 680 120 L 665 160 L 635 165 L 615 200 L 610 155 Z' },
  { abbr: 'IN', d: 'M 598 220 L 635 215 L 640 285 L 598 285 Z' },
  { abbr: 'OH', d: 'M 635 215 L 685 210 L 690 285 L 640 285 Z' },
  { abbr: 'KY', d: 'M 598 285 L 690 285 L 695 335 L 650 345 L 595 340 L 565 330 L 565 315 Z' },
  { abbr: 'TN', d: 'M 565 330 L 595 340 L 695 335 L 700 375 L 605 380 L 560 375 Z' },
  { abbr: 'MS', d: 'M 560 375 L 605 380 L 608 435 L 580 450 L 555 435 Z' },
  { abbr: 'AL', d: 'M 605 380 L 650 375 L 655 450 L 608 450 Z' },
  { abbr: 'GA', d: 'M 650 375 L 710 370 L 715 445 L 685 470 L 655 460 L 650 415 Z' },
  { abbr: 'FL', d: 'M 655 460 L 685 470 L 720 455 L 740 480 L 730 520 L 690 540 L 650 520 L 640 490 Z' },
  { abbr: 'SC', d: 'M 700 340 L 730 335 L 745 360 L 720 385 L 710 370 Z' },
  { abbr: 'NC', d: 'M 695 310 L 760 305 L 765 335 L 730 345 L 700 340 Z' },
  // Mid-Atlantic / Northeast
  { abbr: 'VA', d: 'M 695 285 L 760 280 L 765 305 L 700 310 L 700 295 Z' },
  { abbr: 'WV', d: 'M 685 250 L 715 248 L 720 280 L 700 290 L 690 285 Z' },
  { abbr: 'PA', d: 'M 690 210 L 760 205 L 763 248 L 715 248 L 685 248 Z' },
  { abbr: 'NY', d: 'M 730 155 L 810 150 L 815 195 L 763 200 L 760 205 L 690 210 L 680 185 L 700 165 Z' },
  { abbr: 'MD', d: 'M 763 240 L 800 238 L 802 255 L 770 258 L 763 248 Z' },
  { abbr: 'DE', d: 'M 790 248 L 800 248 L 800 265 L 788 265 Z' },
  { abbr: 'NJ', d: 'M 775 210 L 800 208 L 800 248 L 775 248 L 772 230 Z' },
  { abbr: 'CT', d: 'M 805 195 L 835 190 L 835 205 L 808 208 Z' },
  { abbr: 'RI', d: 'M 835 195 L 850 193 L 850 208 L 835 210 Z' },
  { abbr: 'MA', d: 'M 795 175 L 855 168 L 858 190 L 835 193 L 808 195 Z' },
  { abbr: 'NH', d: 'M 830 148 L 855 145 L 858 168 L 830 172 Z' },
  { abbr: 'VT', d: 'M 808 148 L 830 148 L 830 175 L 808 175 Z' },
  { abbr: 'ME', d: 'M 830 100 L 880 95 L 885 148 L 855 148 L 830 148 Z' },
  // Insets
  { abbr: 'AK', d: 'M 55 450 L 155 450 L 170 465 L 165 510 L 130 525 L 80 525 L 55 505 Z' },
  { abbr: 'HI', d: 'M 190 490 L 215 485 L 225 500 L 210 515 L 185 512 Z' },
];

type CoverageTier = 'state-form' | 'federal-only' | 'none';

interface StatePathProps {
  abbr: string;
  d: string;
  tier: CoverageTier;
  onHover: (abbr: string, e: React.MouseEvent) => void;
  onLeave: () => void;
}

const TIER_FILL: Record<CoverageTier, string> = {
  'state-form': '#1a1a1a',
  'federal-only': '#6b7280',
  'none': '#f3f4f6',
};
const TIER_STROKE: Record<CoverageTier, string> = {
  'state-form': '#F5C518',
  'federal-only': '#9ca3af',
  'none': '#d1d5db',
};
const TIER_STROKE_WIDTH: Record<CoverageTier, number> = {
  'state-form': 1.5,
  'federal-only': 0.75,
  'none': 0.5,
};

function StatePath({ abbr, d, tier, onHover, onLeave }: StatePathProps) {
  return (
    <path
      d={d}
      fill={TIER_FILL[tier]}
      stroke={TIER_STROKE[tier]}
      strokeWidth={TIER_STROKE_WIDTH[tier]}
      style={{ cursor: 'default', transition: 'opacity 0.15s' }}
      onMouseEnter={(e) => onHover(abbr, e)}
      onMouseLeave={onLeave}
      onMouseMove={(e) => onHover(abbr, e)}
    />
  );
}

export function UsComplianceMap() {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);

  function getTier(abbr: string): CoverageTier {
    if (abbr in STATE_CPR_FORMS) return 'state-form';
    if (FEDERAL_ONLY_STATES.has(abbr)) return 'federal-only';
    return 'none';
  }

  function handleHover(abbr: string, e: React.MouseEvent) {
    const tier = getTier(abbr);
    const stateName = STATE_NAMES[abbr] ?? abbr;
    const formLabel =
      tier === 'state-form'
        ? STATE_CPR_FORMS[abbr]
        : tier === 'federal-only'
        ? 'Federal WH-347 (no state PW law)'
        : 'Not yet supported';
    setTooltip({ x: e.clientX, y: e.clientY, label: `${stateName} — ${formLabel}` });
  }

  const stateCprCount = Object.keys(STATE_CPR_FORMS).length;
  const federalCount = FEDERAL_ONLY_STATES.size;

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 960 600"
        style={{ width: '100%', height: 'auto', maxHeight: '480px' }}
        aria-label="US state compliance coverage map"
      >
        {STATE_PATHS.map(({ abbr, d }) => (
          <StatePath
            key={abbr}
            abbr={abbr}
            d={d}
            tier={getTier(abbr)}
            onHover={handleHover}
            onLeave={() => setTooltip(null)}
          />
        ))}
      </svg>

      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 14,
            top: tooltip.y - 36,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="bg-nav-dark text-white text-xs px-3 py-1.5 rounded shadow-lg whitespace-nowrap font-body"
        >
          {tooltip.label}
        </div>
      )}

      {/* Coverage stats */}
      <p className="text-center text-xs text-gray-500 font-body mt-2">
        {stateCprCount} states with state-specific CPR forms · {federalCount} states federal WH-347
      </p>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-nav-dark border border-brand-gold" />
          <span className="text-xs text-gray-600 font-body">State-specific CPR form</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-gray-500 border border-gray-400" />
          <span className="text-xs text-gray-600 font-body">Federal WH-347 (no state PW law)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-gray-100 border border-gray-300" />
          <span className="text-xs text-gray-600 font-body">Not supported</span>
        </div>
      </div>
    </div>
  );
}
