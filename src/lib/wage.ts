export type WageUnit = "hourly" | "annual";

export function normalizeToHourly(value: number, unit: WageUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (unit === "hourly") return value;
  // Annual to hourly using 2080 hours/year
  return value / 2080;
}

export type WageLevels = {
  level1: number;
  level2: number;
  level3: number;
  level4: number;
};

export type Determination = {
  offeredHourly: number;
  computedLevel: 1 | 2 | 3 | 4;
  belowLevel1: boolean; // true if offered < level1
};

export function determineWageLevel(
  offeredHourly: number,
  wages: WageLevels
): Determination {
  const { level1, level2, level3, level4 } = wages;
  const belowLevel1 = offeredHourly < level1;
  let computedLevel: 1 | 2 | 3 | 4 = 1;
  if (offeredHourly >= level4) computedLevel = 4;
  else if (offeredHourly >= level3) computedLevel = 3;
  else if (offeredHourly >= level2) computedLevel = 2;
  else computedLevel = 1; // includes belowLevel1 case
  return { offeredHourly, computedLevel, belowLevel1 };
}

export type LotteryEstimate = {
  weight: 1 | 2 | 3 | 4;
  rationale: string;
};

export function estimateLotteryChance(level: 1 | 2 | 3 | 4): LotteryEstimate {
  // User-defined rule: Level 4 -> 4 chances, Level 3 -> 3, etc.
  const weight = level as 1 | 2 | 3 | 4;
  return {
    weight,
    rationale: `Per user-defined policy, Level ${level} receives ${weight} chance${weight > 1 ? "s" : ""} in selection weighting.`,
  };
}
