const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

function getLimaDate(isoString: string | Date): Date {
  const d = new Date(isoString);
  // America/Lima is UTC-5 year-round (no DST)
  return new Date(d.getTime() - 5 * 60 * 60 * 1000);
}

export function fmtDate(isoString: string | Date): string {
  if (!isoString) return '';
  const d = getLimaDate(isoString);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function fmtTime(isoString: string | Date): string {
  if (!isoString) return '';
  const d = getLimaDate(isoString);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function fmtDayLong(isoString: string | Date): string {
  if (!isoString) return '';
  const d = getLimaDate(isoString);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatKickoffInLima(isoString: string | Date): string {
  if (!isoString) return '';
  return `${fmtDate(isoString)} · ${fmtTime(isoString)} (Hora Lima)`;
}

export function getLimaDateTimeLocalString(utcDate: Date | string): string {
  if (!utcDate) return '';
  const d = new Date(utcDate);
  const limaTime = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  return limaTime.toISOString().slice(0, 16);
}

export function parseLimaDateTimeToUtc(localStr: string): string {
  if (!localStr) return '';
  // Check if string already contains offset or 'Z'
  let parsedStr = localStr;
  if (!localStr.match(/(Z|[+-]\d{2}:\d{2})$/)) {
    parsedStr = `${localStr}-05:00`;
  }
  return new Date(parsedStr).toISOString();
}

export function isMatchLocked(kickoffUtc: Date | string, status: string): boolean {
  if (!kickoffUtc) return true;
  const kickoffDate = new Date(kickoffUtc);
  const now = new Date();
  return kickoffDate <= now || status === 'live' || status === 'result';
}

export function isMatchOpen(kickoffUtc: Date | string, status: string): boolean {
  return !isMatchLocked(kickoffUtc, status);
}

export function utcDateKey(isoString: string | Date): string {
  if (!isoString) return '';
  const d = getLimaDate(isoString);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

