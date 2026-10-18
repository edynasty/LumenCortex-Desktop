import type { Locale } from "./i18n/app-copy";

// Each unit and how many seconds it spans; the largest unit that fits wins.
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** Compact "8 min. ago" / "8分钟前" for list rows; under a minute reads as "now". */
export function formatRelative(iso: string, now: number, locale: Locale): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  const seconds = Math.max(0, (now - time) / 1000);
  const unit = UNITS.find(([, span]) => seconds >= span);
  return unit ? format.format(-Math.floor(seconds / unit[1]), unit[0]) : format.format(0, "second");
}
