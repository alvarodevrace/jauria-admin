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
    .admin-shell {
      width: 100%;
      max-width: 100%;
      overflow-x: clip;
    }

    .shell-main {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      margin-left: 240px;
      overflow-x: clip;
      transition: margin-left 0.3s ease;
    }

    .main-content,
    .main-content__inner {
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    @media (max-width: 1024px) {
      .shell-main { margin-left: 0; }
    }
  `],
})
export class ShellComponent {
  @ViewChild('sidebar') sidebar!: SidebarComponent;
}
