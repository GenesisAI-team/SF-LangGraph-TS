# Arquitectura del SGA (v0.1 — bootstrap GEN-16)

## Visión

Sistema Generador de Aplicaciones (SGA): convierte issues de Linear en PRs
verificadas en repos reales, con agentes especializados coordinados por un
motor de ejecución (LangGraph) y políticas de riesgo explícitas.

```
        Linear (issue GEN-N, proyecto Ultimate Coding)
            │                          ▲
            ▼                          │ (comentarios, labels, link a PR)
   ┌──────────────────┐         ┌──────────────────────┐
   │ apps/api         ├────────►│ apps/worker          │
   │ (HTTP, enqueues) │         │ (motor LangGraph)    │
   └──────────────────┘         └──────────┬───────────┘
                                            │ orquesta runs
              tipos puros                   ▼
   ┌──────────────────────┐      ┌──────────────────────┐
   │ packages/contracts   │      │ packages/agents      │
   │ (schemas Zod)        │      │ (roles LLM + prompts)│
   └──────────────────────┘      └──────────┬───────────┘
                                            │ ejecuta con
              ┌─────────────┐               │ skillpacks
              │ skillpacks/ │◄──────────────┘
              └─────────────┘
        ┌─────────────────────┬───────────────────────┐
        ▼                     ▼                       ▼
┌───────────────────┐ ┌──────────────────┐ ┌────────────────────┐
│ packages/sandbox  │ │ packages/        │ │ packages/          │
│ (ejecución        │ │ integrations     │ │ verification       │
│  aislada)         │ │ (GitHub, Linear) │ │ (evidencias, gates)│
└───────────────────┘ └──────────────────┘ └────────────────────┘
```

## Decisiones por capa (resumen; detalle en ADRs)

| Capa        | Módulo                    | Rol                                                               | Estado            |
| ----------- | ------------------------- | ----------------------------------------------------------------- | ----------------- |
| Runtime     | `apps/api`, `apps/worker` | API HTTP y ejecución de runs                                      | PENDIENTE         |
| Tipos       | `packages/contracts`      | esquemas Zod: IssueEnvelope, RunState, RiskPolicy, EvidenceBundle | base implementada |
| Flujo       | `packages/orchestration`  | tabla de transición pura (fuente de verdad)                       | base implementada |
| LLM         | `packages/agents`         | roles + prompts + salidas esquemadas                              | PENDIENTE         |
| Skills      | `skillpacks/*`            | packs instanciables de técnicas                                   | PENDIENTE         |
| Detección   | `packages/verification`   | evidencias, checks, drift                                         | PENDIENTE         |
| Aislamiento | `packages/sandbox`        | ejecución acotada de comandos                                     | PENDIENTE         |
| Mundo real  | `packages/integrations`   | GitHub, Linear, CI                                                | PENDIENTE         |
| Auditoría   | `evals/`                  | evaluaciones con promptfoo                                        | PENDIENTE         |
| IaC         | `infrastructure/`         | protección de ramas, secrets                                      | PENDIENTE         |

## Decisiones de arquitectura

Ver `docs/adr/`: 0001 stack, 0002 contratos tipados, 0003 LangGraph,
0004 riesgo y evidencias, 0005 sandbox/aislamiento.
