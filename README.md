# SF-LangGraph-TS

Software Factory autonoma que transforma tareas aprobadas en Linear en Pull
Requests implementadas, verificadas y preparadas para merge humano.

- Issue fuente: [GEN-16 — Issue 0: Preparación y arquitectura](https://linear.app/genesisnavarra/issue/GEN-16/sf-langgraph-ts-issue-0-preparacion-y-arquitectura-de-la-software)
- Protocolo de trabajo: [Ultimate Coding](https://linear.app/genesisnavarra/document/protocolo-de-trabajo-ultimate-coding-chatgpt-codex-y-opencode-12e289b81826)

## Estado de los componentes

Este repositorio esta en **fase bootstrap**. Lo siguiente esta implementado y lo
demas queda explicitamente pendiente; nada simula funcionalidad operativa.

| Ruta                     | Componente                                     | Estado                               |
| ------------------------ | ---------------------------------------------- | ------------------------------------ |
| `packages/contracts`     | Contratos de entrada, estados y politicas      | En construccion (solo RED de tests)  |
| `packages/orchestration` | Tabla de transicion de estados (pura)          | Pendiente                            |
| `packages/agents`        | Adaptadores de agentes (Codex/OpenCode/Claude) | Pendiente                            |
| `packages/integrations`  | Linear y GitHub                                | Pendiente                            |
| `packages/sandbox`       | Ejecucion aislada                              | Pendiente                            |
| `packages/verification`  | Quality gates y evidencias                     | Pendiente                            |
| `apps/api`               | API e integraciones                            | Pendiente                            |
| `apps/worker`            | Cola y workers (BullMQ)                        | Pendiente                            |
| `apps/dashboard`         | Interfaz auxiliar                              | Pendiente                            |
| `skillpacks/`            | Catalogo de skills                             | Pendiente                            |
| `evals/`                 | Evaluaciones (Promptfoo)                       | Pendiente                            |
| `infrastructure/`        | Docker y despliegue                            | Pendiente                            |
| `docs/`                  | Arquitectura, ADRs, runbooks                   | Pendiente (se rellenan al cerrar F5) |

## Stack

TypeScript (6.0.3), Node 22+ recomendado, pnpm workspaces con catalogo de
versiones, ESLint 10 + typescript-eslint, Prettier, Vitest, Zod.
LangGraph.js, PostgreSQL, Redis/BullMQ, Codex SDK, Docker y OpenTelemetry se
incorporan en las sub-issues correspondientes de GEN-16.

## Comandos

```bash
pnpm install       # instalar dependencias
pnpm lint          # ESLint con reglas type-aware
pnpm typecheck     # tsc --noEmit por paquete
pnpm test          # Vitest por paquete
pnpm build         # compilacion por paquete
pnpm format:check  # Prettier (solo lectura)
pnpm verify        # format + lint + typecheck + test + build
```

## Reglas operativas

- Linear es la fuente de verdad. Una issue `GEN-N` => una rama
  `feat|fix|refactor|chore|docs|perf/GEN-N-descripcion-corta`.
- Todo cambio llega a `main` via PR. `main` esta protegida: PR obligatoria,
  1 aprobacion humana, check `ci` requerido, sin force-push.
- TDD obligatorio para logica nueva: RED -> GREEN -> REFACTOR.
- Los commits y PRs referencian el identificador `GEN-N`.
- Credenciales solo en el entorno; el repositorio no contiene secretos
  (referencia documental en `.env.example`).

## Visibilidad

El repositorio es **publico** por decision explicita del propietario para poder
aplicar proteccion real de rama en el plan actual de GitHub. Esto registra una
desviacion consciente respecto al requisito "privado" de GEN-16, que quedara
documentada en `docs/adr/` y en la issue durante el cierre del bootstrap.
