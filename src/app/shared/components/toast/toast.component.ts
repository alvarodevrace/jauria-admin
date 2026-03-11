import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconComponent } from 'angular-tabler-icons';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, TablerIconComponent],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}">
          <span class="toast__icon">
            @switch (toast.type) {
              @case ('success') { <i-tabler name="check" /> }
              @case ('error') { <i-tabler name="circle-x" /> }
              @case ('warning') { <i-tabler name="alert-triangle" /> }
              @default { <i-tabler name="info-circle" /> }
            }
          </span>
          <span class="toast__message">{{ toast.message }}</span>
          <button class="toast__close btn btn--icon btn--ghost" (click)="toastService.remove(toast.id)">
            <i-tabler name="circle-x" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  toastService = inject(ToastService);
}
