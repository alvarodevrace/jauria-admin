import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, ToastComponent, ConfirmModalComponent],
  template: `
    <div class="admin-shell">
      <app-sidebar #sidebar />
      <div class="shell-main">
        <app-topbar (menuClick)="sidebar.toggle()" />
        <main class="main-content">
          <div class="main-content__inner">
            <router-outlet />
          </div>
        </main>
      </div>
      <app-toast />
      <app-confirm-modal />
    </div>
  `,
  styles: [`
    .shell-main {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      margin-left: 240px;
      transition: margin-left 0.3s ease;
    }
    @media (max-width: 1024px) {
      .shell-main { margin-left: 0; }
    }
  `],
})
export class ShellComponent {
  @ViewChild('sidebar') sidebar!: SidebarComponent;
}
