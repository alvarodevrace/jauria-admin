import { Directive, Input, OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { effect } from '@angular/core';

@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective implements OnInit {
  @Input('appHasRole') roles: string[] = [];

  private auth = inject(AuthService);
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);

  ngOnInit() {
    effect(() => {
      const rol = this.auth.rol();
      this.viewContainer.clear();
      if (rol && this.roles.includes(rol)) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    }, { injector: this.viewContainer.injector });
  }
}
