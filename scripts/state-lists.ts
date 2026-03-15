// ─── State configuration for course import coverage ──────────────────────────
// Tennessee: ALL courses (no cap)
// Ian's Territory (6 states): Top 100 per state
// All other 43 states: Top 50 per state

export type StateConfig = {
  code: string;
  name: string;
  tier: 'full' | 'territory' | 'standard';
  targetCount: number; // 0 = all courses (no limit)
};

// Full coverage — every course in state
const FULL_STATES: StateConfig[] = [
  { code: 'TN', name: 'Tennessee', tier: 'full', targetCount: 0 },
];

// Ian's Territory — top 100 per state
const TERRITORY_STATES: StateConfig[] = [
  { code: 'KY', name: 'Kentucky', tier: 'territory', targetCount: 100 },
  { code: 'IN', name: 'Indiana', tier: 'territory', targetCount: 100 },
  { code: 'SC', name: 'South Carolina', tier: 'territory', targetCount: 100 },
  { code: 'AL', name: 'Alabama', tier: 'territory', targetCount: 100 },
  { code: 'AR', name: 'Arkansas', tier: 'territory', targetCount: 100 },
  { code: 'MS', name: 'Mississippi', tier: 'territory', targetCount: 100 },
];

// Standard states — top 50 per state
const STANDARD_STATES: StateConfig[] = [
  { code: 'AK', name: 'Alaska', tier: 'standard', targetCount: 50 },
  { code: 'AZ', name: 'Arizona', tier: 'standard', targetCount: 50 },
  { code: 'CA', name: 'California', tier: 'standard', targetCount: 50 },
  { code: 'CO', name: 'Colorado', tier: 'standard', targetCount: 50 },
  { code: 'CT', name: 'Connecticut', tier: 'standard', targetCount: 50 },
  { code: 'DE', name: 'Delaware', tier: 'standard', targetCount: 50 },
  { code: 'FL', name: 'Florida', tier: 'standard', targetCount: 50 },
  { code: 'GA', name: 'Georgia', tier: 'standard', targetCount: 50 },
  { code: 'HI', name: 'Hawaii', tier: 'standard', targetCount: 50 },
  { code: 'ID', name: 'Idaho', tier: 'standard', targetCount: 50 },
  { code: 'IL', name: 'Illinois', tier: 'standard', targetCount: 50 },
  { code: 'IA', name: 'Iowa', tier: 'standard', targetCount: 50 },
  { code: 'KS', name: 'Kansas', tier: 'standard', targetCount: 50 },
  { code: 'LA', name: 'Louisiana', tier: 'standard', targetCount: 50 },
  { code: 'ME', name: 'Maine', tier: 'standard', targetCount: 50 },
  { code: 'MD', name: 'Maryland', tier: 'standard', targetCount: 50 },
  { code: 'MA', name: 'Massachusetts', tier: 'standard', targetCount: 50 },
  { code: 'MI', name: 'Michigan', tier: 'standard', targetCount: 50 },
  { code: 'MN', name: 'Minnesota', tier: 'standard', targetCount: 50 },
  { code: 'MO', name: 'Missouri', tier: 'standard', targetCount: 50 },
  { code: 'MT', name: 'Montana', tier: 'standard', targetCount: 50 },
  { code: 'NE', name: 'Nebraska', tier: 'standard', targetCount: 50 },
  { code: 'NV', name: 'Nevada', tier: 'standard', targetCount: 50 },
  { code: 'NH', name: 'New Hampshire', tier: 'standard', targetCount: 50 },
  { code: 'NJ', name: 'New Jersey', tier: 'standard', targetCount: 50 },
  { code: 'NM', name: 'New Mexico', tier: 'standard', targetCount: 50 },
  { code: 'NY', name: 'New York', tier: 'standard', targetCount: 50 },
  { code: 'NC', name: 'North Carolina', tier: 'standard', targetCount: 50 },
  { code: 'ND', name: 'North Dakota', tier: 'standard', targetCount: 50 },
  { code: 'OH', name: 'Ohio', tier: 'standard', targetCount: 50 },
  { code: 'OK', name: 'Oklahoma', tier: 'standard', targetCount: 50 },
  { code: 'OR', name: 'Oregon', tier: 'standard', targetCount: 50 },
  { code: 'PA', name: 'Pennsylvania', tier: 'standard', targetCount: 50 },
  { code: 'RI', name: 'Rhode Island', tier: 'standard', targetCount: 50 },
  { code: 'SD', name: 'South Dakota', tier: 'standard', targetCount: 50 },
  { code: 'TX', name: 'Texas', tier: 'standard', targetCount: 50 },
  { code: 'UT', name: 'Utah', tier: 'standard', targetCount: 50 },
  { code: 'VT', name: 'Vermont', tier: 'standard', targetCount: 50 },
  { code: 'VA', name: 'Virginia', tier: 'standard', targetCount: 50 },
  { code: 'WA', name: 'Washington', tier: 'standard', targetCount: 50 },
  { code: 'WV', name: 'West Virginia', tier: 'standard', targetCount: 50 },
  { code: 'WI', name: 'Wisconsin', tier: 'standard', targetCount: 50 },
  { code: 'WY', name: 'Wyoming', tier: 'standard', targetCount: 50 },
];

export const ALL_STATES: StateConfig[] = [
  ...FULL_STATES,
  ...TERRITORY_STATES,
  ...STANDARD_STATES,
];

export function getFullStates(): StateConfig[] {
  return FULL_STATES;
}

export function getTerritoryStates(): StateConfig[] {
  return [...FULL_STATES, ...TERRITORY_STATES];
}

export function getStatesForMode(mode: 'state' | 'territory' | 'all'): StateConfig[] {
  switch (mode) {
    case 'state': return []; // single state handled by --state flag
    case 'territory': return getTerritoryStates();
    case 'all': return ALL_STATES;
  }
}

export function getStateByCode(code: string): StateConfig | undefined {
  return ALL_STATES.find((s) => s.code === code.toUpperCase());
}
