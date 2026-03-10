import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

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
