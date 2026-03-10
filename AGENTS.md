# AGENTS.md — Jauría CrossFit · Panel Admin

> Este archivo configura **OpenAI Codex CLI** para el proyecto.
> **ROL DE CODEX:** Frontend Angular 18 exclusivamente.
> Para orquestación, infra, n8n, Supabase admin, Linear y Coolify → usar Claude Code.

---

## Proyecto

Panel administrativo Angular 18 para **Jauría CrossFit** — gimnasio CrossFit en Ecuador.
Sistema de cobros con n8n + Supabase + Payphone + Evolution API (WhatsApp).

**Tu responsabilidad:** solo el código Angular en `src/`. No modificar infraestructura ni workflows.

---

## Stack técnico

- **Framework:** Angular 18.2.14 — standalone components (sin NgModules)
- **Estilos:** SCSS con design system propio (NO Angular Material, NO Tailwind)
- **Auth:** Supabase Auth + JWT — `AuthService` en `core/auth/`
- **State:** Angular Signals (`signal()`, `computed()`, `effect()`)
- **HTTP:** `HttpClient` con interceptores en `core/interceptors/`
- **Errores:** GlitchTip via `@sentry/angular` — `SentryService` en `core/services/`
- **Gráficos:** Chart.js + ng2-charts (solo en Dashboard)
- **Fechas:** date-fns + date-fns-tz (UTC-5 Ecuador)
- **Puerto dev:** 4300 (`npm start`)

---

## Paleta de colores — DEFINITIVA (no modificar)

```scss
$color-bg:       #0a0a0a;   // negro fondo
$color-surface:  #141414;   // tarjetas, sidebar
$color-surface2: #1e1e1e;   // inputs, hover
$color-primary:  #B71C1C;   // rojo sangre — ÚNICO color de acento
$color-white:    #FFFFFF;
$color-text:     #CCCCCC;
$color-muted:    #666666;
$color-border:   #2a2a2a;
```

Tipografías:
- Títulos/headings: **Bebas Neue** (`font-family: 'Bebas Neue', sans-serif`)
- Cuerpo: **Inter** (`font-family: 'Inter', -apple-system, sans-serif`)

---

## Estructura de archivos

```
src/
├── app/
│   ├── app.config.ts          ← providers: router, http, animations, Sentry
│   ├── app.routes.ts          ← lazy loading por feature + guards
│   ├── core/
│   │   ├── auth/
│   │   │   ├── auth.service.ts    ← Supabase Auth, signals, roles
│   │   │   ├── auth.guard.ts      ← protege rutas sin sesión
│   │   │   └── role.guard.ts      ← protege rutas por rol
│   │   ├── interceptors/
│   │   │   ├── jwt.interceptor.ts       ← Bearer token en HTTP
│   │   │   └── http-error.interceptor.ts ← captura 4xx/5xx → Sentry
│   │   ├── layout/
│   │   │   ├── shell/             ← AppShell: sidebar + topbar + router-outlet
│   │   │   ├── sidebar/           ← navegación lateral filtrada por rol
│   │   │   └── topbar/            ← título dinámico + hamburger mobile
│   │   └── services/
│   │       ├── supabase.service.ts   ← cliente Supabase centralizado
│   │       ├── n8n.service.ts        ← REST API n8n (solo lectura/toggle)
│   │       ├── coolify.service.ts    ← REST API Coolify (env vars)
│   │       ├── evolution.service.ts  ← Evolution API (WhatsApp)
│   │       ├── toast.service.ts      ← notificaciones temporales (signals)
│   │       └── sentry.service.ts     ← helpers GlitchTip
│   ├── shared/
│   │   ├── components/
│   │   │   └── toast/             ← ToastComponent global
│   │   ├── directives/
│   │   │   └── has-role.directive.ts  ← *appHasRole="['coach','admin']"
│   │   └── pipes/
│   │       ├── date-ec.pipe.ts    ← fechas UTC-5 Ecuador
│   │       └── plan-label.pipe.ts ← "MENSUAL · $55"
│   └── features/              ← lazy-loaded por ruta
│       ├── auth/login/
│       ├── auth/registro/         ← gateado por membresía activa
│       ├── auth/forgot-password/
│       ├── auth/reset-password/
│       ├── dashboard/             ← solo admin
│       ├── clientes/              ← coach + admin
│       ├── clases/                ← todos (atleta necesita membresía Activa)
│       ├── pagos/                 ← coach + admin
│       ├── conversaciones/        ← coach + admin
│       ├── leads/                 ← solo admin
│       ├── configuracion/         ← coach + admin
│       ├── workflows/             ← solo admin
│       ├── mi-cuenta/             ← todos
│       ├── mi-pago/               ← solo atleta
│       └── roles/                 ← solo admin
├── environments/
│   ├── environment.ts         ← dev: URLs reales + GlitchTip DSN
│   └── environment.prod.ts    ← prod: keys via CI/CD
└── styles/
    ├── _variables.scss        ← paleta, fuentes, breakpoints
    ├── _typography.scss       ← clases de texto
    ├── _animations.scss       ← keyframes
    └── _admin.scss            ← layout sidebar/topbar, componentes UI
```

---

## Roles y permisos

| Rol | Rutas permitidas |
|---|---|
| `atleta` | `/app/clases`, `/app/mi-cuenta`, `/app/mi-pago` |
| `coach` | + clientes, pagos, conversaciones, configuración |
| `admin` | + dashboard, leads, workflows, roles |

**Regla crítica:** un atleta solo puede inscribirse a clases si `clientes.estado = 'Activo'`.
Coach y admin pueden inscribirse sin restricción.

---

## Flujo de alta de atleta

```
1. Coach crea cliente (tabla clientes en Supabase)
2. n8n valida pago → estado='Activo'
3. Atleta va a /auth/registro → ingresa email
4. Sistema verifica email en clientes con estado='Activo'
   ├─ NO: error → "El coach debe registrarte primero"
   └─ SÍ: crea cuenta + profile con id_cliente vinculado
```

Coach y admin NO pasan por el registro público — se crean directamente en Supabase.

---

## Supabase — tablas relevantes para frontend

### `clientes` (usada por n8n y admin)
`id_cliente` (TEXT, ej: C001) · `nombre_completo` · `email` · `telefono_whatsapp` ·
`plan` (MENSUAL|TRIMESTRAL|ANUAL) · `monto_plan` · `estado` (Activo|Pendiente|Vencido|Inactivo) ·
`metodo_pago` (TRANSFERENCIA|PAYPHONE) · `fecha_vencimiento` · `link_pago_actual`

### `profiles` (solo admin panel)
`id` (UUID → auth.users) · `id_cliente` (FK, nullable) · `nombre_completo` · `email` ·
`rol` (atleta|coach|admin) · `avatar_url` · `activo`

### `clases`
`id` · `tipo` (WOD|Open Gym|Barbell Club|Fundamentos) · `fecha` · `hora_inicio` · `hora_fin` ·
`capacidad_maxima` · `coach_id` (FK profiles) · `cancelada` · `descripcion`

### `inscripciones`
`id` · `clase_id` (FK) · `user_id` (FK profiles) · `estado` (inscrito|asistio|no_asistio|cancelado) ·
UNIQUE(clase_id, user_id)

### `historial_pagos`
`id` · `id_cliente` · `nombre_cliente` · `fecha_pago` · `monto` · `metodo` · `banco` ·
`referencia_transaccion` · `estado` · `periodo_pagado`

### `leads` (de landing page)
`id` · `nombre` · `email` · `telefono` · `mensaje` · `programa` · `created_at`

### `auditoria_config`
`id` · `user_id` · `accion` · `detalle` (JSONB) · `created_at`

---

## Patrones obligatorios en Angular

### 1. Siempre standalone
```typescript
@Component({ standalone: true, imports: [...], ... })
```

### 2. Estado con Signals
```typescript
// ✅ Correcto
data = signal<MiTipo[]>([]);
loading = signal(false);
derivado = computed(() => this.data().filter(...));

// ❌ Incorrecto
data$ = new BehaviorSubject([]);
```

### 3. Inyección de dependencias
```typescript
// ✅ Angular 18
private service = inject(MiService);

// ❌ No usar constructor injection
constructor(private service: MiService) {}
```

### 4. Template control flow (@if / @for)
```html
<!-- ✅ Angular 17+ -->
@if (loading()) { <div>Cargando...</div> }
@for (item of items(); track item.id) { ... } @empty { <div>Vacío</div> }

<!-- ❌ No usar -->
*ngIf="loading()"
*ngFor="let item of items()"
```

### 5. Tipado explícito — NUNCA Record<string, unknown> en templates
```typescript
// ✅ Definir interfaz
interface Cliente { id_cliente: string; nombre_completo: string; estado: string; }
clientes = signal<Cliente[]>([]);

// ❌ Genera NG1/NG5 errors en templates
clientes = signal<Record<string, unknown>[]>([]);
```

### 6. Async/await en servicios (no Observables para llamadas únicas)
```typescript
// ✅ Para llamadas únicas
async ngOnInit() {
  const { data, error } = await this.supabase.getClientes();
}

// Observables solo para n8nService, coolifyService, evolutionService
this.n8n.getWorkflows().subscribe({ next: ..., error: ... });
```

---

## Clases CSS del design system (usar siempre — no reinventar)

### Layout
- `.admin-shell` — wrapper principal
- `.main-content__inner` — padding 32px
- `.page-header` + `__eyebrow` + `__title` + `__subtitle`
- `.stats-grid` — grid auto-fit 200px

### Componentes
- `.data-table-wrapper` + `__header` + `__title`
- `.data-table` — tabla estilizada
- `.badge` + `--activo` `--pendiente` `--vencido` `--inactivo` `--completado` `--fallido`
- `.stat-card` + `__label` + `__value` + `__trend`
- `.service-card` + `__name` + `__detail`
- `.status-indicator` + `--online` `--offline` `--warning`
- `.modal-backdrop` + `.modal` + `__header` + `__title` + `__body` + `__footer`
- `.toast-container` + `.toast` + `--success` `--error` `--info` `--warning`
- `.skeleton` + `--text` `--title` `--card`

### Botones
- `.btn` + `--primary` `--secondary` `--ghost` `--danger`
- `.btn--sm` `--icon`

### Formularios
- `.form-group` + `.form-label` + `.form-control` + `.form-error`
- `.search-input`

### Alertas
- `.alert` + `--warning` `--error` `--info` `--success`

---

## Variables de entorno (ya configuradas)

```typescript
// src/environments/environment.ts
environment.supabaseUrl      // https://bxatcmcommoqnxnyqchu.supabase.co
environment.supabaseAnonKey  // (configurado)
environment.n8nApiUrl        // https://n8n.alvarodevrace.tech/api/v1
environment.coolifyUrl       // https://coolify.alvarodevrace.tech/api/v1
environment.evolutionApiUrl  // https://evolution.alvarodevrace.tech
environment.sentryDsn        // https://KEY@glitchtip.alvarodevrace.tech/1
```

---

## Reglas de trabajo para Codex

### ✅ HACER
- Crear y modificar componentes en `src/app/features/` y `src/app/shared/`
- Usar el design system existente (`_admin.scss`, `_variables.scss`)
- Seguir los patrones de componentes existentes como referencia
- Usar `SentryService.captureError()` en bloques catch
- Usar `ToastService` para feedback al usuario
- Tipado explícito con interfaces en todos los signals
- Build limpio antes de considerar terminada una tarea: `npm run build`

### ❌ NO HACER
- Modificar `CLAUDE.md` — es de Claude Code
- Llamar directamente a APIs de n8n para ejecutar workflows (usar `N8nService`)
- Cambiar `environment.ts` salvo `sentryDsn`
- Modificar `app.config.ts` ni `app.routes.ts` sin coordinación
- Instalar paquetes sin verificar que no conflictan con Angular 18
- Usar Angular Material, PrimeNG, Bootstrap ni Tailwind
- Crear archivos `.module.ts` (el proyecto es 100% standalone)
- Usar `@Input()` / `@Output()` decorators — preferir signals e inject()
- Subir a `main` directamente — trabajar siempre en `develop`

---

## Comandos esenciales

```bash
npm start          # dev server → localhost:4300
npm run build      # production build — SIEMPRE verificar antes de push
git checkout develop   # rama de trabajo
git push origin develop
```

---

## Servicio Supabase — métodos disponibles

```typescript
// inyectar: private supabase = inject(SupabaseService);
supabase.getClientes(filters?)
supabase.getCliente(id)
supabase.createCliente(data)
supabase.updateCliente(id, data)
supabase.getHistorialPagos(filters?)
supabase.getConversacionesActivas()
supabase.getLeads()
supabase.getProfile(userId)
supabase.updateProfile(userId, data)
supabase.getAllProfiles()
supabase.updateProfileRole(userId, rol)
supabase.getClases(filters?)
supabase.createClase(data)
supabase.updateClase(id, data)
supabase.inscribirseAClase(claseId, userId)
supabase.cancelarInscripcion(claseId, userId)
supabase.getInscripcionesByClase(claseId)
supabase.getInscripcionesByUser(userId)
supabase.marcarAsistencia(inscripcionId, asistio)
supabase.logAuditoria(userId, accion, detalle?)
supabase.getAuditoria(limit?)
// acceso directo al cliente Supabase:
supabase.client.from('tabla').select(...)
```

---

## AuthService — signals disponibles

```typescript
// inyectar: private auth = inject(AuthService);
auth.session()          // Session | null
auth.profile()          // UserProfile | null
auth.loading()          // boolean
auth.isAuthenticated()  // computed boolean
auth.currentUser()      // User | null
auth.rol()              // 'atleta' | 'coach' | 'admin' | null
auth.isAdmin()          // computed boolean
auth.isCoach()          // computed boolean (true para coach Y admin)
auth.login(email, password)
auth.logout()
auth.getAccessToken()
```

---

## Referencia rápida de colores de tipos de clase

```typescript
// Usados en ClasesComponent
WOD:          bg=rgba(183,28,28,0.2)  color=#B71C1C
Open Gym:     bg=rgba(80,80,80,0.2)   color=#CCCCCC
Barbell Club: bg=rgba(123,17,17,0.2)  color=#7B1111
Fundamentos:  bg=rgba(33,150,243,0.2) color=#42a5f5
```
