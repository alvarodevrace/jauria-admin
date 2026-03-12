import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Only add JWT to API calls (not Google Fonts, CDNs, etc.)
  const isApiCall = req.url.includes('supabase.co') ||
    (environment.backendApiUrl ? req.url.includes(environment.backendApiUrl) : false) ||
    req.url.includes('n8n.alvarodevrace.tech') ||
    req.url.includes('coolify.alvarodevrace.tech') ||
    req.url.includes('evolution.alvarodevrace.tech');

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
