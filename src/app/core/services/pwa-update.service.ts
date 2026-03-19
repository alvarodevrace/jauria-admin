import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, first } from 'rxjs';
import { ConfirmDialogService } from './confirm-dialog.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  private readonly checkIntervalMs = 60_000;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private promptOpen = false;

  constructor() {
    if (!this.updates.isEnabled) {
      return;
    }

    this.appRef.isStable
      .pipe(
        filter((stable) => stable),
        first(),
      )
      .subscribe(() => {
        void this.checkForUpdates();
        this.startPolling();
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
      });

    this.updates.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
      )
      .subscribe(() => {
        void this.promptAndReload();
      });

    this.updates.unrecoverable.subscribe((event) => {
      this.toast.warning('La app necesita recargarse para recuperar la sesión más reciente.');
      console.error('[PWA] unrecoverable state', event.reason);
      setTimeout(() => window.location.reload(), 1200);
    });
  }

  private startPolling(): void {
    this.intervalId = setInterval(() => {
      void this.checkForUpdates();
    }, this.checkIntervalMs);
  }

  private async checkForUpdates(): Promise<void> {
    try {
      await this.updates.checkForUpdate();
    } catch (error) {
      console.error('[PWA] update check failed', error);
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      void this.checkForUpdates();
    }
  };

  private async promptAndReload(): Promise<void> {
    if (this.promptOpen) {
      return;
    }

    if (this.isStandalone()) {
      this.toast.info('Actualizando app...');
      setTimeout(async () => {
        try {
          await this.updates.activateUpdate();
        } finally {
          window.location.reload();
        }
      }, 600);
      return;
    }

    this.promptOpen = true;

    try {
      const shouldReload = await this.confirmDialog.open({
        title: 'Actualización disponible',
        message: 'Hay una nueva versión de la app lista para instalar.\n\nActualiza ahora para cargar los cambios más recientes.',
        confirmLabel: 'Actualizar ahora',
        cancelLabel: 'Luego',
        tone: 'primary',
      });

      if (!shouldReload) {
        this.toast.info('La nueva versión quedará lista cuando vuelvas a abrir la app.');
        return;
      }

      await this.updates.activateUpdate();
      window.location.reload();
    } catch (error) {
      console.error('[PWA] update activation failed', error);
      window.location.reload();
    } finally {
      this.promptOpen = false;
    }
  }

  private isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }
}
