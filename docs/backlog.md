# Backlog de la Software Factory (F7, GEN-16)

Desglose de GEN-16 en sub-issues a crear en Linear. Una sub-issue = un repo
por tocar y una PR futura (regla: 1 issue -> 1 repo -> 1 PR). Cada entrada
declara objetivo, criterio de aceptacion, dependencias y limites.

## 1. Orchestrator — RunState + motor LangGraph

- Objetivo: motor de episodios que mueve runs por la tabla de
  `@sf/orchestration` con checkpointing LangGraph y `TransitionEvent`.
- Aceptacion: toda transicion emite evento tipado; transiciones ilegales
  se rechazan; tests deterministas sin LLM.
- Dependencias: contracts, orchestration, apps/worker.
- Limites: sin integraciones externas; persistencia se decide en ADR propio.

## 2. Agent Manager — roles Codex/OpenCode/Claude

- Objetivo: adaptadores LLM con roles (plan, implement, verify, review,
  repair), salida esquemada, reintentos y presupuesto.
- Aceptacion: cada role devuelve salida parseable contra `@sf/contracts`;
  el presupuesto de intentos se respeta; evals con LLM simulado.
- Dependencias: contracts, apps/worker.
- Limites: sin credenciales en codigo; configuracion por environment.

## 3. Quality gates y pipeline de verificacion

- Objetivo: verificar acceptanceCriteria con tests reales y artefactos de
  salida, sin confiar en el reporte del agente.
- Aceptacion: `EvidenceBundle` capturado por intento; deteccion de drift
  entre PR y objetivo original.
- Dependencias: packages/agents, apps/worker.
- Limites: los gates no sustituyen al CI real; lo complementan.

## 4. Integraciones Linear y GitHub (reales)

- Objetivo: leer issues de Linear, actualizar labels/comentarios de la issue
  propia, y abrir PRs con checks en GitHub.
- Aceptacion: operaciones idempotentes; estados Linear reflejados segun la
  tabla de `@sf/orchestration`.
- Dependencias: contracts, orchestration.
- Limites: nunca toca issues ajenas ni hace merges.

## 5. Sandbox — ejecucion aislada

- Objetivo: aislar la ejecucion de comandos por repo: worktree por
  episodio, allow-list de comandos, captura de logs.
- Aceptacion: comandos prohibidos se rechazan; logs capturables; limpieza
  de worktrees al terminar.
- Dependencias: apps/worker.
- Limites: sin red externa por defecto.

## 6. apps/worker — runner de episodios

- Objetivo: ejecutar episodios con el motor LangGraph, persistencia en
  Postgres y cola en BullMQ.
- Aceptacion: un run completo recorre estados legales con checkpoints
  reproducibles; presupuesto por intento respetido; sin concurrencia por
  encima de `RiskPolicy`.
- Dependencias: orchestrator, agents, sandbox, integrations.
- Limites: aislado por episodio y por repo.

## 7. apps/api

- Objetivo: endpoints (runs, runs/:id, webhooks de Linear y GitHub) para
  gatillar y consultar episodios.
- Aceptacion: esquema OpenAPI verificado con tests; webhooks con
  autenticacion validada.
- Dependencias: apps/worker.
- Limites: sin llamadas LLM directas.

## 8. apps/dashboard (v0)

- Objetivo: vista para humanos de episodios: estados, presupuesto, tiempo
  y acceso a evidencias.
- Aceptacion: solo lectura; sin dominios nuevos.
- Dependencias: apps/api.
- Limites: alcance minimo viable.

## 9. skillpacks — instalacion y adaptacion

- Objetivo: instalar los packs de `skillpacks/catalog.md` en los agentes
  segun la fase del workflow.
- Aceptacion: cada skill valida su conducta en el flujo del agente antes
  de considerarse instalada.
- Dependencias: agents.
- Limites: adaptaciones registradas en notas del catalogo.

## 10. evals — evaluaciones

- Objetivo: evaluar roles y skills con mocks primero y promptfoo cuando la
  plataforma local soporte Node >= 22.22.
- Aceptacion: evals no bloquean CI; corren bajo tolerancia explicita.
- Dependencias: agents, verification.
- Limites: los evals no son producto.

## 11. Persistencia — Postgres y Redis

- Objetivo: esquemas de persistencia para runs, eventos, evidencias y
  checkpoints.
- Aceptacion: migraciones idempotentes; sin secretos en el repositorio.
- Dependencias: ninguna adicional.
- Limites: infraestructura separada; compose local para desarrollo.

## 12. Observabilidad de runs

- Objetivo: telemetria (OpenTelemetry), logs estructurados y trazas por
  episodio para auditoria.
- Aceptacion: cada run concentra su traza bajo el mismo episode ID; las
  evidencias quedan linkeadas en Linear.
- Dependencias: apps/worker, persistencia.
- Limites: rotacion y coste de logs acotados.
