import { Pipe, PipeTransform } from '@angular/core';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { ECUADOR_TIME_ZONE, parseEcuadorDate } from '../utils/date-ecuador';

@Pipe({ name: 'dateEc', standalone: true })
export class DateEcPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, fmt = 'dd/MM/yyyy'): string {
    if (!value) return '—';
    try {
      const date = typeof value === 'string'
        ? /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? parseEcuadorDate(value)
          : new Date(value)
        : value;
      const formatted = formatInTimeZone(date, ECUADOR_TIME_ZONE, fmt, { locale: es });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return String(value);
    }
  }
}
