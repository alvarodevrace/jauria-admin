import { addDays, differenceInCalendarDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const ECUADOR_TIME_ZONE = 'America/Guayaquil';

export function getEcuadorNow(): Date {
  return toZonedTime(new Date(), ECUADOR_TIME_ZONE);
}

export function getStartOfEcuadorWeek(base: Date = new Date()): Date {
  return startOfWeek(toZonedTime(base, ECUADOR_TIME_ZONE), { weekStartsOn: 1 });
}

export function getEcuadorTodayYmd(): string {
  return formatInTimeZone(new Date(), ECUADOR_TIME_ZONE, 'yyyy-MM-dd');
}

export function formatEcuadorDate(value: string | Date, fmt: string): string {
  const date = typeof value === 'string'
    ? /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseEcuadorDate(value)
      : new Date(value)
    : value;
  return formatInTimeZone(date, ECUADOR_TIME_ZONE, fmt, { locale: es });
}

export function parseEcuadorDate(date: string): Date {
  return fromZonedTime(`${date}T00:00:00`, ECUADOR_TIME_ZONE);
}

export function parseEcuadorDateTime(date: string, time: string): Date {
  return fromZonedTime(`${date}T${normalizeTime(time)}`, ECUADOR_TIME_ZONE);
}

export function getDaysFromTodayInEcuador(date: string): number {
  return differenceInCalendarDays(parseEcuadorDate(date), parseEcuadorDate(getEcuadorTodayYmd()));
}

export function addDaysToEcuadorDate(date: string, days: number): string {
  return formatInTimeZone(addDays(parseEcuadorDate(date), days), ECUADOR_TIME_ZONE, 'yyyy-MM-dd');
}

function normalizeTime(time: string): string {
  if (!time) return '00:00:00';
  return time.length === 5 ? `${time}:00` : time;
}
