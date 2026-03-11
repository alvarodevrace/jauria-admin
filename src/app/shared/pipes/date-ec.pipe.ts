import { Pipe, PipeTransform } from '@angular/core';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const TZ = 'America/Guayaquil';

@Pipe({ name: 'dateEc', standalone: true })
export class DateEcPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, fmt = 'dd/MM/yyyy'): string {
    if (!value) return '—';
    try {
      const date = typeof value === 'string' ? new Date(value) : value;
      const formatted = formatInTimeZone(date, TZ, fmt, { locale: es });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return String(value);
    }
  }
}
