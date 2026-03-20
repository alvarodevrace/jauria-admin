import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleAnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private initialized = false;

  init(): void {
    if (this.initialized || !this.isEnabled()) return;
    this.initialized = true;

    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${environment.ga4MeasurementId}`;
    this.document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag(...args: unknown[]) {
        window.dataLayer.push(args);
      };

    window.gtag('js', new Date());
    window.gtag('config', environment.ga4MeasurementId, {
      anonymize_ip: true,
      page_path: this.router.url,
      page_title: this.document.title,
      page_location: window.location.href,
    });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.trackPageView(event.urlAfterRedirects);
      });
  }

  trackLogin(): void {
    this.trackEvent('login', { method: 'email_password' });
  }

  trackReminderSent(idCliente: string): void {
    this.trackEvent('send_reminder_manual', { id_cliente: idCliente });
  }

  private trackPageView(path: string): void {
    if (!this.isEnabled() || !window.gtag) return;

    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: this.document.title,
      page_location: window.location.href,
    });
  }

  private trackEvent(name: string, params: Record<string, unknown>): void {
    if (!this.isEnabled() || !window.gtag) return;
    window.gtag('event', name, params);
  }

  private isEnabled(): boolean {
    return environment.production && !!environment.ga4MeasurementId && typeof window !== 'undefined';
  }
}
