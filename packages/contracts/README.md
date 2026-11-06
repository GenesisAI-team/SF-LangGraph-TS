# @sf/contracts

Contratos compartidos de la Software Factory: sobre de entrada de issues
(`IssueEnvelope`), estados de ejecucion, eventos de transicion, politica de
riesgo/presupuesto y paquete de evidencias.

Estado actual: **base implementada**. `IssueEnvelope`, `RunState`,
`TransitionEvent`, `RiskPolicy` y `EvidenceBundle` con esquemas Zod y tests
en verde. Sin lógica de negocio (ADR 0002).

Referencias:

- GEN-16, seccion 4 (arquitectura) y seccion 8 (reglas de ingenieria).
- ADRs 0002 y 0004 en `docs/adr/`.
