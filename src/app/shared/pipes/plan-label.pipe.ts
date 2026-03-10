import { Pipe, PipeTransform } from '@angular/core';

const LABELS: Record<string, string> = {
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  ANUAL: 'Anual',
};

@Pipe({ name: 'planLabel', standalone: true })
export class PlanLabelPipe implements PipeTransform {
  transform(plan: string | null | undefined, monto?: number): string {
    if (!plan) return '—';
    const label = LABELS[plan] ?? plan;
    return monto != null ? `${label} · $${monto.toFixed(2)}` : label;
  }
}
