import { Pipe, PipeTransform } from '@angular/core';
import { formatInTimeZone } from 'date-fns-tz';

const TZ = 'America/Guayaquil';

@Pipe({ name: 'dateEc', standalone: true })
export class DateEcPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, fmt = 'dd/MM/yyyy'): string {
    if (!value) return '—';
    try {
      const date = typeof value === 'string' ? new Date(value) : value;
      return formatInTimeZone(date, TZ, fmt);
    } catch {
      return String(value);
    }
  }
}
