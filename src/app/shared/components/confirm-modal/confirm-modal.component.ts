import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    @if (confirmDialog.state().open) {
      <div class="modal-backdrop" (click)="confirmDialog.cancel()">
        <div class="modal confirm-modal" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">{{ confirmDialog.state().title }}</h3>
            <button
              class="btn btn--ghost btn--icon btn--icon-clean"
              (click)="confirmDialog.cancel()"
              aria-label="Cerrar confirmación"
            >
              <i-lucide name="circle-x" />
            </button>
          </div>

          <div class="modal__body">
            <p class="confirm-modal__message">{{ confirmDialog.state().message }}</p>
          </div>

          <div class="modal__footer confirm-modal__footer">
            <button class="btn btn--ghost" (click)="confirmDialog.cancel()">
              {{ confirmDialog.state().cancelLabel }}
            </button>
            <button
              class="btn"
              [class.btn--danger]="confirmDialog.state().tone === 'danger'"
              [class.btn--primary]="confirmDialog.state().tone === 'primary'"
              (click)="confirmDialog.confirm()"
            >
              {{ confirmDialog.state().confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-modal {
      max-width: 520px;
      width: min(520px, calc(100vw - 32px));
    }

    .confirm-modal__message {
      margin: 0;
      color: #d2cbc1;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .confirm-modal__footer {
      justify-content: flex-end;
    }
  `],
})
export class ConfirmModalComponent {
  readonly confirmDialog = inject(ConfirmDialogService);
}
