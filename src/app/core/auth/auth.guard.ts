import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Esperar a que termine la carga inicial del token
  if (auth.loading()) {
    await firstValueFrom(
      toObservable(auth.loading).pipe(filter(loading => !loading))
    );
  }

  if (!auth.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  return true;
};
