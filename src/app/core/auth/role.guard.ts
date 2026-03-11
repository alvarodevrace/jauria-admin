import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

export const roleGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.loading()) {
    await firstValueFrom(
      toObservable(auth.loading).pipe(filter((loading) => !loading))
    );
  }

  const requiredRoles: string[] = route.data['roles'] ?? [];
  const userRol = auth.rol();

  if (!userRol || !requiredRoles.includes(userRol)) {
    // Redirect to their home based on role
    const fallback = userRol ? '/app/clases' : '/auth/login';
    router.navigate([fallback]);
    return false;
  }

  return true;
};
