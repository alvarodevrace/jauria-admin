import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isApiCall = req.url.includes('supabase.co') ||
    (environment.backendApiUrl ? req.url.includes(environment.backendApiUrl) : false);

  if (!isApiCall) return next(req);

  return from(auth.getAccessToken()).pipe(
    switchMap((token) => {
      if (token && (req.url.includes('supabase.co') || (environment.backendApiUrl && req.url.includes(environment.backendApiUrl)))) {
        const cloned = req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        });
        return next(cloned);
      }
      return next(req);
    })
  );
};
