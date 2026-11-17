# @sf/agents

Agent Manager de la factory: roles estructurados (plan, implement, verify,
review, repair) con salidas esquemadas por rol, presupuesto de intentos,
errores tipados y adaptadores simulados deterministas (GEN-53).

## Como funciona

- `AgentAdapter` es la unica frontera con el "modelo": por ahora solo existe
  `ScriptedAgentAdapter`, un fake determinista que consume guiones por rol y,
  agotado el guion, repite la ultima salida. Los adaptadores reales (Codex
  SDK, OpenCode, Claude) se conectaran en sub-issues, sin credenciales en el
  codigo: la configuracion llegara por environment.
- `AgentManager` (`createAgentManager`) valida la peticion con
  `agentRequestSchema` (rol, episodio, `issueId` y `branch` de `@sf/contracts`),
  invoca al adaptador y valida cada salida cruda contra el esquema Zod del rol
  (`@sf/contracts` para la evidencia, limites de `TransitionEvent` para los
  resumenes). La salida invalida se reintenta hasta `budget.maxAttempts`
  (`ExecutionBudget`, el mismo presupuesto del motor); agotado, lanza
  `AgentBudgetExhaustedError` con una entrada de evidencia por intento.
- `createRoleStepHandlers` integra los roles con `@sf/engine`: un handler por
  estado `planning`, `implementing`, `verifying`, `reviewing` y `repairing`
  que invoca al manager y traduce la salida validada a `StepResult`
  (transiciones legales, fallos reparables o definitivos con evidencia). Los
  checks del rol verify se convierten en `EvidenceEntry`; una verificacion
  fallida o un review con cambios disparan el ciclo de reparacion del motor.

## Errores tipados

`InvalidAgentRequestError` (peticion malformada, sin reintentos),
`AgentBudgetExhaustedError` (presupuesto agotado, con evidencia) y
`NoScriptedOutputError` (adaptador simulado sin guion), todos bajo
`AgentsError`.

## Determinismo y alcance

Sin LLM, sin red y sin reloj implicito: los tests scriptan las salidas y
comparan episodios completos entre si. El detalle de cada rol (prompts,
skillpacks) y las credenciales reales pertenecen a otras sub-issues del
backlog.
