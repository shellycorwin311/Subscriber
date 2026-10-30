// Formats a date that represents a pure calendar day (delivery date, press
// run date, pay period boundary) without letting the browser's local
// timezone shift it. Dates like these are stored as UTC midnight, so
// reading the UTC parts directly avoids the off-by-one-day bug that
// `.toLocaleDateString()` causes for anyone west of UTC.
export function formatDateUTC(isoString: string): string {
  const d = new Date(isoString);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}