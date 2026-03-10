import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private nextId = 0;

  show(message: string, type: ToastType = 'info', duration = 4000) {
    const id = this.nextId++;
    this._toasts.update((t) => [...t, { id, message, type }]);
    setTimeout(() => this.remove(id), duration);
  }

  success(message: string) { this.show(message, 'success'); }
  error(message: string)   { this.show(message, 'error', 6000); }
  info(message: string)    { this.show(message, 'info'); }
  warning(message: string) { this.show(message, 'warning', 5000); }

  remove(id: number) {
    this._toasts.update((t) => t.filter((toast) => toast.id !== id));
  }
}
