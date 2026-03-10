import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter, withViewTransitions, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import * as Sentry from '@sentry/angular';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { environment } from '../environments/environment';

const providers: ApplicationConfig['providers'] = [
  provideRouter(routes, withViewTransitions(), withRouterConfig({ onSameUrlNavigation: 'reload' })),
  provideHttpClient(withInterceptors([jwtInterceptor, httpErrorInterceptor])),
  provideAnimations(),
];

// Sentry error handler solo si hay DSN configurado
if (environment.sentryDsn) {
  providers.push({
    provide: ErrorHandler,
    useValue: Sentry.createErrorHandler({ showDialog: false }),
  });
}

export const appConfig: ApplicationConfig = { providers };
