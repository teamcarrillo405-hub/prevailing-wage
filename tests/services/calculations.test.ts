import {
  calculateFringeCredit,
  calculateCwhssaOt,
  calculateLoadedRate,
  checkApprenticeRatio,
  calculateApprenticeRate,
} from '../../src/server/services/calculations.js';

describe('calculateFringeCredit', () => {
  it.todo('CALC-01: DOL Fact Sheet 66E — $2,000 / 2,000 hrs = $1.00/hr fringe credit');
  it.todo('CALC-01: total hours denominator — using DBA-only 1,500 hrs would give $1.33 (wrong)');
  it.todo('CALC-01: zero hours input returns 0 credit (guard clause)');
});

describe('calculateCwhssaOt', () => {
  it.todo('CWHSSA: DOL worked example — 44 hrs, $22 base, $5 fringe = $1,232 total');
  it.todo('CWHSSA: fringe at 1.0x for all hours — NOT 1.5x for OT hours');
  it.todo('CWHSSA: zero OT hours (40hr week) produces no overtime premium');
});

describe('calculateLoadedRate', () => {
  it.todo('CALC-02: loaded rate sums base + ficaSS + ficaMedicare + futaPerHour + sutaPerHour + fringe');
  it.todo('CALC-02: ficaSS = 0 when ytdWages >= $176,100 (SS wage base cap)');
  it.todo('CALC-02: futaPerHour = 0 when annualWages >= $7,000 (FUTA wage base cap)');
  it.todo('CALC-02: FUTA uses min(annualWages, 7000) not flat percentage of all wages');
});

describe('calculateApprenticeRate', () => {
  it.todo('CALC-03: calculateApprenticeRate — 60% of $22.00 JW rate = $13.20');
});

describe('checkApprenticeRatio', () => {
  it.todo('CALC-04: 5 JWs, ratio 1:3, 2 apprentices → violation (maxAllowed=1, excess=1)');
  it.todo('CALC-04: 3 JWs, ratio 1:3, 1 apprentice → no violation (exactly at limit)');
  it.todo('CALC-04: 0 JWs, any apprentices → violation (no JWs means no apprentices allowed)');
});
