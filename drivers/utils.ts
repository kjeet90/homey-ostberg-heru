export const pad = (value: number) => String(value).padStart(2, '0');

// In the order of the units' weekday bit mask: bit 0 is Monday, bit 6 is Sunday
export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function weekdaysToMask(isEnabled: (weekday: string) => boolean) {
    return WEEKDAYS.reduce((mask, weekday, bit) => (isEnabled(weekday) ? mask | (1 << bit) : mask), 0);
}

export function isWeekdayInMask(mask: number, weekday: string) {
    return !!(mask & (1 << WEEKDAYS.indexOf(weekday)));
}

export const WEEKDAY_NAMES =['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// The date and time in a time zone, with the weekday counted from Monday = 0 like the units do
export function getLocalTime(timeZone: string, date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
    return {
        weekday: WEEKDAY_NAMES.indexOf(part('weekday')),
        year: Number(part('year')),
        month: Number(part('month')),
        day: Number(part('day')),
        hours: Number(part('hour')),
        minutes: Number(part('minute')),
        seconds: Number(part('second'))
    };
}

// Dates without a time are kept at midnight UTC, so the time zone never shifts the day
const isoDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });

export function formatIsoDate(date: Date) {
    const parts = isoDateFormat.formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

// Parses YYYY-MM-DD. Date rolls a day that doesn't exist, like 2026-02-30, over to the next month, so formatting it back catches that.
export function parseIsoDate(text: unknown): Date | null {
    const value = String(text ?? '').trim();
    const date = new Date(`${value}T00:00:00Z`);
    if (isNaN(date.getTime()) || formatIsoDate(date) !== value) return null;
    return date;
}

// The IQC stores a date as the year and the month and day as MMDD, so 2026 and 1224 is 24 December 2026
export function fromUnitDate(year: number, monthDay: number): Date | null {
    const month = Math.floor(monthDay / 100);
    const day = monthDay % 100;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
}

export function toUnitDate(date: Date) {
    return { year: date.getUTCFullYear(), monthDay: (date.getUTCMonth() + 1) * 100 + date.getUTCDate() };
}
