// "It's Wednesday Afternoon": the day and the part of it. No DOM.

/** @typedef {import("./types.js").Moment} Moment */

export const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** In clock order. `from` is the first hour (0-23) of the period. */
export const PERIODS = [
  { id: "late-night", label: "Late Night", from: 0 },
  { id: "morning", label: "Morning", from: 5 },
  { id: "late-morning", label: "Late Morning", from: 9 },
  { id: "afternoon", label: "Afternoon", from: 12 },
  { id: "evening", label: "Evening", from: 17 },
  { id: "night", label: "Night", from: 21 },
];

/** @param {string} s */
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * @param {Date} date
 * @param {{ day?: string | null, period?: string | null }} [override] pin either part,
 *   e.g. from `?day=friday&period=night`. Unknown values are ignored.
 * @returns {Moment}
 */
export function momentOf(date, override = {}) {
  const hour = date.getHours();
  const clock = PERIODS.filter((p) => hour >= p.from).at(-1) ?? PERIODS[0];
  const period = PERIODS.find((p) => p.id === override.period) ?? clock;
  const day = DAYS.find((d) => d === override.day) ?? DAYS[date.getDay()];
  return {
    day,
    period: period.id,
    month: date.getMonth() + 1,
    label: `${capitalize(day)} ${period.label}`,
  };
}
