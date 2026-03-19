import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  open: boolean;
}

const DEFAULT_STATE: ConfirmDialogState = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  tone: 'danger',
};

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private resolver: ((value: boolean) => void) | null = null;
  private readonly _state = signal<ConfirmDialogState>(DEFAULT_STATE);
  readonly state = this._state.asReadonly();

  open(options: ConfirmDialogOptions) {
    this.resolver?.(false);

    this._state.set({
      ...DEFAULT_STATE,
      ...options,
      open: true,
    });

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  confirm() {
    this.resolve(true);
  }

  cancel() {
    this.resolve(false);
  }

  private resolve(result: boolean) {
    this.resolver?.(result);
    this.resolver = null;
    this._state.set(DEFAULT_STATE);
  }
}
