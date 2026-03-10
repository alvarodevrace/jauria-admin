import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SentryService } from '../services/sentry.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const sentry = inject(SentryService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Capturar errores HTTP relevantes en Sentry
      if (error.status >= 400) {
        sentry.captureError(error, {
          url: req.url,
          method: req.method,
          status: error.status,
          statusText: error.statusText,
        });
      }
      return throwError(() => error);
    })
  );
};
