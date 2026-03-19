import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { AppBusyService } from './core/services/app-busy.service';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    @if (shouldBlockMobileBrowser()) {
      <main class="install-gate">
        <section class="install-card" aria-labelledby="install-gate-title">
          <img
            class="install-logo"
            src="assets/logo.png"
            alt="Jauría CrossFit"
            width="104"
            height="104"
          />

          <p class="install-kicker">Acceso móvil protegido</p>
          <h1 id="install-gate-title" class="install-title">
            DESCARGA LA APLICACION OFICIAL DE JAURIA EN TU CELULAR
          </h1>
          <p class="install-copy">
            El panel administrativo en navegador web queda habilitado solo para escritorio.
            En celular debes instalar la app oficial para usarlo de forma segura y estable.
          </p>

          @if (canPromptInstall()) {
            <button type="button" class="install-primary" (click)="installApp()">
              Instalar aplicacion
            </button>
          } @else {
            <div class="install-instructions">
              <p class="install-instructions-title">
                {{ isIosDevice() ? 'Instala desde Safari' : 'Instala desde el navegador' }}
              </p>
              <p class="install-instructions-copy">
                {{ installInstructions() }}
              </p>
            </div>
          }

          <p class="install-footnote">
            Si necesitas entrar desde web, abre esta misma URL en una computadora.
          </p>
        </section>
      </main>
    } @else {
      <router-outlet />

      @if (auth.loading() || appBusy.busy()) {
        <div class="app-busy-overlay" aria-live="polite" aria-busy="true">
          <div class="app-busy-card">
            <div class="app-busy-spinner"></div>
            <p class="app-busy-message">
              {{ auth.loading() ? 'Cargando sesión...' : appBusy.message() }}
            </p>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100dvh;
    }

    .install-gate {
      min-height: 100dvh;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(circle at top, rgba(183, 28, 28, 0.28), transparent 44%),
        linear-gradient(180deg, #08090a 0%, #121416 100%);
    }

    .install-card {
      width: min(100%, 420px);
      border-radius: 28px;
      border: 1px solid rgba(244, 241, 235, 0.1);
      background: rgba(17, 18, 20, 0.92);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.36);
      padding: 32px 24px;
      text-align: center;
      color: #f4f1eb;
    }

    .install-logo {
      width: 104px;
      height: 104px;
      object-fit: contain;
      display: block;
      margin: 0 auto 18px;
      filter: drop-shadow(0 12px 24px rgba(183, 28, 28, 0.28));
    }

    .install-kicker {
      margin: 0 0 10px;
      color: #f97373;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 11px;
      font-weight: 800;
    }

    .install-title {
      margin: 0;
      font: 800 clamp(1.9rem, 7vw, 2.6rem) / 0.95 'Manrope', sans-serif;
      text-wrap: balance;
    }

    .install-copy,
    .install-footnote,
    .install-instructions-copy {
      margin: 0;
      font-family: 'Manrope', sans-serif;
      line-height: 1.55;
      color: rgba(244, 241, 235, 0.84);
    }

    .install-copy {
      margin-top: 18px;
      font-size: 15px;
    }

    .install-primary {
      width: 100%;
      margin-top: 22px;
      border: 0;
      border-radius: 16px;
      background: linear-gradient(135deg, #b71c1c 0%, #db3b3b 100%);
      color: #fff7f4;
      padding: 16px 18px;
      font: 800 15px/1 'Manrope', sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      box-shadow: 0 18px 36px rgba(183, 28, 28, 0.34);
    }

    .install-instructions {
      margin-top: 22px;
      padding: 18px;
      border-radius: 18px;
      background: rgba(244, 241, 235, 0.05);
      border: 1px solid rgba(244, 241, 235, 0.08);
      text-align: left;
    }

    .install-instructions-title {
      margin: 0 0 8px;
      color: #fff7f4;
      font: 700 14px/1.3 'Manrope', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .install-footnote {
      margin-top: 18px;
      font-size: 13px;
      color: rgba(244, 241, 235, 0.68);
    }

    .app-busy-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(8, 9, 10, 0.58);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .app-busy-card {
      min-width: 220px;
      max-width: 320px;
      border: 1px solid #2b3033;
      border-radius: 18px;
      background: rgba(21, 23, 24, 0.96);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      text-align: center;
    }

    .app-busy-spinner {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 3px solid rgba(244, 241, 235, 0.12);
      border-top-color: #a61f24;
      animation: appBusySpin 0.9s linear infinite;
    }

    .app-busy-message {
      margin: 0;
      font-family: 'Manrope', sans-serif;
      font-size: 13px;
      color: #f4f1eb;
      line-height: 1.5;
    }

    @keyframes appBusySpin {
      to {
        transform: rotate(360deg);
      }
    }
  `],
})
export class AppComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly appBusy = inject(AppBusyService);

  protected readonly canPromptInstall = signal(false);
  protected readonly isIosDevice = signal(false);

  private readonly isStandalone = signal(false);
  private readonly isMobileBrowser = signal(false);
  protected readonly shouldBlockMobileBrowser = computed(
    () => this.isMobileBrowser() && !this.isStandalone(),
  );

  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

  ngOnInit(): void {
    this.refreshClientMode();
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', this.handleAppInstalled);
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.refreshClientMode();
  }

  protected installInstructions = computed(() => {
    if (this.isIosDevice()) {
      return 'Toca Compartir en Safari y luego "Agregar a pantalla de inicio".';
    }

    return 'Abre el menu del navegador y selecciona "Instalar aplicacion" o "Agregar a pantalla de inicio".';
  });

  protected async installApp(): Promise<void> {
    if (!this.deferredInstallPrompt) {
      return;
    }

    await this.deferredInstallPrompt.prompt();
    const choice = await this.deferredInstallPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      this.deferredInstallPrompt = null;
      this.canPromptInstall.set(false);
    }
  }

  private refreshClientMode(): void {
    const userAgent = navigator.userAgent ?? '';
    const width = Math.min(window.innerWidth, window.innerHeight);
    const mobileByUa = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

    this.isIosDevice.set(/iPhone|iPad|iPod/i.test(userAgent));
    this.isStandalone.set(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    this.isMobileBrowser.set((mobileByUa || coarsePointer) && width <= 1024);
  }

  private readonly handleBeforeInstallPrompt = (event: Event): void => {
    event.preventDefault();
    this.deferredInstallPrompt = event as BeforeInstallPromptEvent;
    this.canPromptInstall.set(true);
    this.refreshClientMode();
  };

  private readonly handleAppInstalled = (): void => {
    this.deferredInstallPrompt = null;
    this.canPromptInstall.set(false);
    this.refreshClientMode();
  };
}
