import {
  localIso,
  todayIso,
  getMondayIso,
  getSundayIso,
  getWeekDays,
  fmtLastReport,
  fmtDateHeading,
  getDateBlock,
  getMonthLabel,
  parseLocalDate,
  WEEKDAYS,
  WEEKDAYS_ABR,
  MONTHS,
  MONTHS_LONG,
} from './dates';

// Fixed reference date: Tuesday October 13, 2026 at noon local time
const FIXED_DATE = new Date(2026, 9, 13, 12, 0, 0); // months are 0-indexed

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_DATE);
});

afterAll(() => {
  jest.useRealTimers();
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe('WEEKDAYS', () => {
  test('has 7 entries starting with Domingo', () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe('Domingo');
    expect(WEEKDAYS[1]).toBe('Lunes');
    expect(WEEKDAYS[6]).toBe('Sábado');
  });
});

describe('WEEKDAYS_ABR', () => {
  test('has 7 abbreviated entries', () => {
    expect(WEEKDAYS_ABR).toHaveLength(7);
    expect(WEEKDAYS_ABR[0]).toBe('DOM');
    expect(WEEKDAYS_ABR[1]).toBe('LUN');
    expect(WEEKDAYS_ABR[2]).toBe('MAR');
  });
});

describe('MONTHS', () => {
  test('has 12 lowercase entries', () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe('enero');
    expect(MONTHS[9]).toBe('octubre');
    expect(MONTHS[11]).toBe('diciembre');
  });
});

describe('MONTHS_LONG', () => {
  test('has 12 capitalized entries', () => {
    expect(MONTHS_LONG).toHaveLength(12);
    expect(MONTHS_LONG[0]).toBe('Enero');
    expect(MONTHS_LONG[9]).toBe('Octubre');
  });
});

// ─── localIso ─────────────────────────────────────────────────────────────────

describe('localIso', () => {
  test('formats a date as YYYY-MM-DD', () => {
    expect(localIso(new Date(2026, 9, 13))).toBe('2026-10-13');
  });

  test('zero-pads month and day', () => {
    expect(localIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('handles December 31', () => {
    expect(localIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

// ─── parseLocalDate ───────────────────────────────────────────────────────────

describe('parseLocalDate', () => {
  test('parses ISO string to a Date at local noon', () => {
    const d = parseLocalDate('2026-10-13');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // October
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(12);
  });

  test('does not shift the date — noon prevents TZ edge cases', () => {
    // A date parsed at T00:00:00 in UTC-3 would show as the previous day locally.
    // T12:00:00 avoids this for any timezone between UTC-12 and UTC+11.
    const d = parseLocalDate('2026-01-01');
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
    expect(d.getFullYear()).toBe(2026);
  });
});

// ─── todayIso ─────────────────────────────────────────────────────────────────

describe('todayIso', () => {
  test('returns current local date as YYYY-MM-DD', () => {
    expect(todayIso()).toBe('2026-10-13');
  });
});

// ─── getMondayIso ─────────────────────────────────────────────────────────────

describe('getMondayIso', () => {
  test('returns Monday of the current week (from Tuesday)', () => {
    // Fixed date is Tuesday Oct 13 → Monday should be Oct 12
    expect(getMondayIso()).toBe('2026-10-12');
  });

  test('returns same day when today is Monday', () => {
    jest.setSystemTime(new Date(2026, 9, 12, 12, 0, 0)); // Monday Oct 12
    expect(getMondayIso()).toBe('2026-10-12');
    jest.setSystemTime(FIXED_DATE); // restore
  });

  test('returns 6 days back when today is Sunday', () => {
    jest.setSystemTime(new Date(2026, 9, 18, 12, 0, 0)); // Sunday Oct 18
    expect(getMondayIso()).toBe('2026-10-12');
    jest.setSystemTime(FIXED_DATE); // restore
  });
});

// ─── getSundayIso ─────────────────────────────────────────────────────────────

describe('getSundayIso', () => {
  test('returns Sunday of the current week (from Tuesday)', () => {
    expect(getSundayIso()).toBe('2026-10-18');
  });

  test('returns same day when today is Sunday', () => {
    jest.setSystemTime(new Date(2026, 9, 18, 12, 0, 0)); // Sunday Oct 18
    expect(getSundayIso()).toBe('2026-10-18');
    jest.setSystemTime(FIXED_DATE); // restore
  });
});

// ─── getWeekDays ──────────────────────────────────────────────────────────────

describe('getWeekDays', () => {
  test('returns exactly 7 days', () => {
    expect(getWeekDays()).toHaveLength(7);
  });

  test('week starts on Monday and ends on Sunday', () => {
    const days = getWeekDays();
    expect(days[0].iso).toBe('2026-10-12'); // Monday
    expect(days[6].iso).toBe('2026-10-18'); // Sunday
  });

  test('day letters are L M M J V S D', () => {
    const days = getWeekDays();
    expect(days.map((d) => d.letter)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });

  test('marks today correctly (Tuesday = index 1)', () => {
    const days = getWeekDays();
    expect(days[1].isToday).toBe(true);
    expect(days[0].isToday).toBe(false);
    expect(days[2].isToday).toBe(false);
  });

  test('marks future days correctly', () => {
    const days = getWeekDays();
    expect(days[0].isFuture).toBe(false); // Monday (past)
    expect(days[1].isFuture).toBe(false); // Tuesday (today)
    expect(days[2].isFuture).toBe(true);  // Wednesday (future)
    expect(days[6].isFuture).toBe(true);  // Sunday (future)
  });

  test('num matches day of month', () => {
    const days = getWeekDays();
    expect(days[0].num).toBe(12); // Mon Oct 12
    expect(days[1].num).toBe(13); // Tue Oct 13
    expect(days[6].num).toBe(18); // Sun Oct 18
  });
});

// ─── fmtLastReport ───────────────────────────────────────────────────────────

describe('fmtLastReport', () => {
  test('formats Monday as "lunes 12"', () => {
    expect(fmtLastReport('2026-10-12')).toBe('lunes 12');
  });

  test('formats Tuesday as "martes 13"', () => {
    expect(fmtLastReport('2026-10-13')).toBe('martes 13');
  });

  test('formats Sunday as "domingo 18"', () => {
    expect(fmtLastReport('2026-10-18')).toBe('domingo 18');
  });

  test('day name is lowercase', () => {
    const result = fmtLastReport('2026-10-12');
    expect(result[0]).toBe(result[0].toLowerCase());
  });

  test('does not shift day when parsing ISO date', () => {
    // Should always show Oct 1 regardless of timezone
    const result = fmtLastReport('2026-10-01');
    expect(result).toMatch(/1$/);
  });
});

// ─── fmtDateHeading ───────────────────────────────────────────────────────────

describe('fmtDateHeading', () => {
  test('returns correct heading for Tuesday Oct 13', () => {
    const { line1, line2 } = fmtDateHeading();
    expect(line1).toBe('Martes 13');
    expect(line2).toBe('de octubre');
  });

  test('line1 uses capitalized day name', () => {
    const { line1 } = fmtDateHeading();
    expect(line1[0]).toBe(line1[0].toUpperCase());
  });
});

// ─── getDateBlock ─────────────────────────────────────────────────────────────

describe('getDateBlock', () => {
  test('returns LUN and 12 for Monday Oct 12', () => {
    expect(getDateBlock('2026-10-12')).toEqual({ abbrev: 'LUN', num: 12 });
  });

  test('returns MAR and 13 for Tuesday Oct 13', () => {
    expect(getDateBlock('2026-10-13')).toEqual({ abbrev: 'MAR', num: 13 });
  });

  test('returns DOM and 18 for Sunday Oct 18', () => {
    expect(getDateBlock('2026-10-18')).toEqual({ abbrev: 'DOM', num: 18 });
  });
});

// ─── getMonthLabel ────────────────────────────────────────────────────────────

describe('getMonthLabel', () => {
  test('returns "Octubre 2026"', () => {
    expect(getMonthLabel('2026-10-13')).toBe('Octubre 2026');
  });

  test('returns "Enero 2027"', () => {
    expect(getMonthLabel('2027-01-01')).toBe('Enero 2027');
  });

  test('returns "Diciembre 2025"', () => {
    expect(getMonthLabel('2025-12-15')).toBe('Diciembre 2025');
  });
});
