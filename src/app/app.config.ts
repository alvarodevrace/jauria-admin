import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter, withViewTransitions, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import * as Sentry from '@sentry/angular';
import { TablerIconsProvider } from 'angular-tabler-icons';
import {
  IconAlertTriangle,
  IconBarbell,
  IconBolt,
  IconChartBar,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconClipboard,
  IconCreditCard,
  IconInfoCircle,
  IconKey,
  IconLink,
  IconLogout2,
  IconMail,
  IconMessage,
  IconPencil,
  IconSend,
  IconSettings2,
  IconUser,
  IconUsers,
  IconWallet,
} from 'angular-tabler-icons/icons';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { environment } from '../environments/environment';

const providers: ApplicationConfig['providers'] = [
  provideRouter(routes, withViewTransitions(), withRouterConfig({ onSameUrlNavigation: 'reload' })),
  provideHttpClient(withInterceptors([jwtInterceptor, httpErrorInterceptor])),
  provideAnimations(),
  TablerIconsProvider.pick({
    IconAlertTriangle,
    IconBarbell,
    IconBolt,
    IconChartBar,
    IconCheck,
    IconCircleCheck,
    IconCircleX,
    IconClipboard,
    IconCreditCard,
    IconInfoCircle,
    IconKey,
    IconLink,
    IconLogout2,
    IconMail,
    IconMessage,
    IconPencil,
    IconSend,
    IconSettings2,
    IconUser,
    IconUsers,
    IconWallet,
  }),
];

// Sentry error handler solo si hay DSN configurado
if (environment.sentryDsn) {
  providers.push({
    provide: ErrorHandler,
    useValue: Sentry.createErrorHandler({ showDialog: false }),
  });
}

export const appConfig: ApplicationConfig = { providers };
