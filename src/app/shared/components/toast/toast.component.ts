import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}">
          <span class="toast__icon">
            @switch (toast.type) {
              @case ('success') { <i-lucide name="check" /> }
              @case ('error') { <i-lucide name="circle-x" /> }
              @case ('warning') { <i-lucide name="alert-triangle" /> }
              @default { <i-lucide name="info-circle" /> }
            }
          </span>
          <span class="toast__message">{{ toast.message }}</span>
          <button class="toast__close btn btn--icon btn--ghost" (click)="toastService.remove(toast.id)">
            <i-lucide name="circle-x" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  toastService = inject(ToastService);
}
