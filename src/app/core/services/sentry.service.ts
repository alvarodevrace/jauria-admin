import { Injectable } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { environment } from '../../../environments/environment';

/**
 * Servicio centralizado para captura de errores con Sentry.
 * Uso: inject(SentryService) y llamar a los helpers.
 */
@Injectable({ providedIn: 'root' })
export class SentryService {
  private enabled = environment.sentryEnabled && !!environment.sentryDsn;

  /** Captura un error con contexto adicional */
  captureError(error: unknown, context?: Record<string, unknown>) {
    console.error('[Error]', error, context);
    if (!this.enabled) return;
    Sentry.withScope(scope => {
      if (context) scope.setExtras(context);
      Sentry.captureException(error);
    });
  }

  /** Captura un mensaje informativo (no error) */
  captureMessage(msg: string, level: Sentry.SeverityLevel = 'info') {
    if (!this.enabled) return;
    Sentry.captureMessage(msg, level);
  }

  /** Añade un breadcrumb (traza de acciones del usuario) */
  addBreadcrumb(message: string, category = 'ui', data?: Record<string, unknown>) {
    if (!this.enabled) return;
    Sentry.addBreadcrumb({ message, category, data, level: 'info' });
  }

  /** Marca el inicio de una transacción de performance */
  startTransaction(name: string, op = 'navigation') {
    if (!this.enabled) return null;
    return Sentry.startInactiveSpan({ name, op });
  }

  /** Alerta crítica — se envía aunque no haya errores JS */
  alertaCritica(titulo: string, detalle: Record<string, unknown>) {
    if (!this.enabled) return;
    Sentry.captureMessage(`ALERTA: ${titulo}`, 'warning');
    Sentry.withScope(scope => {
      scope.setExtras(detalle);
      Sentry.captureMessage(`ALERTA: ${titulo}`, 'warning');
    });
  }
}
