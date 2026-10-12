export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAYS_ABR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Parses an ISO date string at local noon to avoid timezone-induced day shifts on Android
export function parseLocalDate(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

// Returns YYYY-MM-DD using local timezone — DO NOT use toISOString() which returns UTC
export function localIso(d: Date): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return localIso(new Date());
}

export function getMondayIso(): string {
  const d    = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  return localIso(mon);
}

export function getSundayIso(): string {
  const d    = new Date();
  const diff = d.getDay() === 0 ? 0 : 7 - d.getDay();
  const sun  = new Date(d);
  sun.setDate(d.getDate() + diff);
  return localIso(sun);
}

export function getWeekDays() {
  const today    = todayIso();
  const mondayStr = getMondayIso();
  const monday   = new Date(mondayStr + 'T12:00:00');
  const letters  = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = localIso(d);
    return { iso, letter: letters[i], num: d.getDate(), isFuture: iso > today, isToday: iso === today };
  });
}

// "lunes 5" — lowercase day name + day number from ISO date
export function fmtLastReport(iso: string): string {
  const d = parseLocalDate(iso);
  return `${WEEKDAYS[d.getDay()].toLowerCase()} ${d.getDate()}`;
}

// Today's heading: { line1: "Lunes 5", line2: "de octubre" }
export function fmtDateHeading() {
  const d = new Date();
  return {
    line1: `${WEEKDAYS[d.getDay()]} ${d.getDate()}`,
    line2: `de ${MONTHS[d.getMonth()]}`,
  };
}

// "LUN" + day number from ISO date — used in historial cards
export function getDateBlock(iso: string) {
  const d = parseLocalDate(iso);
  return { abbrev: WEEKDAYS_ABR[d.getDay()], num: d.getDate() };
}

// "Octubre 2026" from ISO date — used as section header in historial
export function getMonthLabel(iso: string): string {
  const d = parseLocalDate(iso);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}
