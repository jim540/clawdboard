/** Earliest date accepted for custom date range queries */
export const MIN_DATE = "2024-01-01";

/** How long the "NEW" badge shows on the leaderboard after signup */
export const NEW_USER_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

/** Valid time period filter values (client-safe, no server imports) */
export const VALID_PERIODS = [
  "today",
  "7d",
  "30d",
  "this-month",
  "ytd",
  "custom",
] as const;

export type Period = (typeof VALID_PERIODS)[number];
