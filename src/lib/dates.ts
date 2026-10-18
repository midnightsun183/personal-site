// Date labels from ISO dates (YYYY-MM-DD). Parsed by hand so the server's time zone never shifts a day.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/** "Oct 2026" */
export function monthYear(iso: string): string {
  const [y, m] = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "October 17, 2026" */
export function longDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

/** "2026" */
export function year(iso: string): string {
  return iso.slice(0, 4);
}
