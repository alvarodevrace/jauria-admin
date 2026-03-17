import { ApplicationConfig, ErrorHandler, importProvidersFrom } from '@angular/core';
import { provideRouter, withViewTransitions, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import * as Sentry from '@sentry/angular';
import { LucideAngularModule } from 'lucide-angular';
import {
  BadgeInfo,
  ChartBar,
  Check,
  CircleCheck,
  CircleX,
  Clipboard,
  CreditCard,
  Dumbbell,
  Eye,
  EyeOff,
  Key,
  Link,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Settings,
  Trash2,
  Trophy,
  TriangleAlert,
  User,
  Users,
  Wallet,
  Zap,
} from 'lucide-angular';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { environment } from '../environments/environment';

const providers: ApplicationConfig['providers'] = [
  provideRouter(routes, withViewTransitions(), withRouterConfig({ onSameUrlNavigation: 'reload' })),
  provideHttpClient(withInterceptors([jwtInterceptor, httpErrorInterceptor])),
  provideAnimations(),
  importProvidersFrom(
    LucideAngularModule.pick({
      AlertTriangle: TriangleAlert,
      Barbell: Dumbbell,
      Bolt: Zap,
      ChartBar,
      Check,
      CircleCheck,
      CircleX,
      Clipboard,
      CreditCard,
      Eye,
      EyeOff,
      InfoCircle: BadgeInfo,
      Key,
      Link,
      LoaderCircle,
      Logout2: LogOut,
      Mail,
      Message: MessageSquare,
      Pencil,
      Plus,
      Send,
      Settings2: Settings,
      Trash: Trash2,
      Trophy,
      User,
      Users,
      Wallet,
    }),
  ),
];

// Sentry error handler solo si está habilitado y hay DSN configurado
if (environment.sentryEnabled && environment.sentryDsn) {
  providers.push({
    provide: ErrorHandler,
    useValue: Sentry.createErrorHandler({ showDialog: false }),
  });
}

export const appConfig: ApplicationConfig = { providers };
