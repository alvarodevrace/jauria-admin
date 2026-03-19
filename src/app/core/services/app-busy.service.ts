import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppBusyService {
  private readonly _count = signal(0);
  private readonly _message = signal('Procesando...');

  readonly busy = computed(() => this._count() > 0);
  readonly message = this._message.asReadonly();

  start(message = 'Procesando...') {
    this._message.set(message);
    this._count.update((count) => count + 1);
  }

  stop() {
    this._count.update((count) => Math.max(0, count - 1));
  }
}
