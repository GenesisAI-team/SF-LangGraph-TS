# AGENTS.md — Protocolo operacional de agentes (SGA)

Este archivo es la regla operativa para cualquier agente (Codex, Claude,
opencode, GLM) que trabaje en este repositorio. Complementa
`docs/architecture/overview.md`; no lo reemplaza.

## Identidad del Sistema Generador de Aplicaciones (SGA)

La factory es un sistema determinista y auditable que convierte una issue de
Linear en una PR humana-verificable. Un episodio = un run de ejecución con
presupuesto, riesgos y evidencias acotadas. Los agentes hacen el trabajo;
los humanos aprueban merges y desbloqueos.

## Reglas no negociables

1. **Linear es la fuente de verdad.** Toda tarea vive en una issue `GEN-N`
   del equipo Genesis (proyecto Ultimate Coding). Un run puede solo actualizar
   labels, comentarios, links y campos de su **propia issue**.
2. **Una issue → un repo → una PR.** Prohibido mezclar dominios en una PR.
3. **Código = BLUE.** Todo cambio de código nace de una issue `GEN-N`.
4. **Historial protegido.** No push directo a `main`, no force push, no
   rebase histórico. Todo vía PR con: ≥1 aprobación humana, CI verde
   (check `ci`), conversaciones resueltas.
5. **TDD estricto.** Primero el test que falla (RED), luego el mínimo GREEN,
   luego REFACTOR. Commits pueden ser separados.
6. **Quality gates en verde antes de abrir PR:** `pnpm verify`
   (format + lint + typecheck + test + build).
7. **Estado del run válido solo por la tabla de transición**
   (`@sf/orchestration`). Pasar de un estado a uno no sucesor es un bug.
8. **Sin secretos.** Nunca loguear ni commitear credenciales. Config por
   environment; patrón en `.env.example`.
9. **Evidencias siempre.** Aunque el reporte de review esté DIFERIDO, el run
   genera bundle de evidencias (tests, logs, salida CI) para auditoría
   independiente.
10. **Sin cobertura "truena".** Prohibido: comparar PR contra `HEAD` en vez
    de `main`, inventar issues ya existentes, reportar "done" sin CI verde,
    borrar o "limpiar" ajenos sin aprobación.

## Nombres de rama (canónico)

`{type}/GEN-{N}-{slug}` con `type ∈ feat|fix|refactor|chore|docs|perf`, todo
minúsculas, sin espacios. Ej.: `feat/GEN-21-runstate-langgraph`.

## Estados de Linear ↔ workflow de la factory

| Linear      | Estado del run                            | Gate para salir                                       |
| ----------- | ----------------------------------------- | ----------------------------------------------------- |
| Todo        | `ready`                                   | envelope completo + aprobación humana                 |
| In Progress | `preparing` → `planning` → `implementing` | plan y sandbox listos                                 |
| In Progress | `verifying`                               | `pnpm verify` verde localmente                        |
| In Review   | `reviewing` → `prReady`                   | CI verde en PR + revisión obtenida                    |
| In Review   | `awaitingMerge`                           | aprobación humana explícita                           |
| Done        | `done`                                    | PR mergeada y evidencias archivadas                   |
| Takky       | `blocked`                                 | decisión humana (solo el humano desbloquea)           |
| Takky       | `repairing`                               | reintentos con presupuesto; humano decide al agotarlo |

## Comandos del workspace

```bash
pnpm install                     # desde la raíz (workspace pnpm con catalog:)
pnpm -F @sf/contracts test       # tests de un solo paquete
pnpm verify                      # gates locales completos
```

## Si el humano pide algo que rompe estas reglas

Confirmar; el agente explica el riesgo y propone alternativa, pero el humano
es quien firma y mergea. Un desvío aceptado se documenta en un ADR
(`docs/adr/NNNN-slug.md`).
