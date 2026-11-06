# ADR 0004 — Riesgo acotado y evidencias obligatorias

- Estado: Aceptado (GEN-16)
- Fecha: 2026-11-01

## Contexto

Un run puede fallar de forma invisible (test falso, cobertura sórdida,
reporte no coincidente con la salida real). El sistema necesita evidencias
independientes del reporte del agente y límites explícitos de riesgo.

## Decisión

- `RiskPolicy` fija máximo global de reintentos, timeout por run,
  concurrencia y coste; `ExecutionBudget` acota cada attempt por episode.
- Toda PR viene con `EvidenceBundle` (checks tests, sílogas salida CI, logs)
  generado por el run, aunque el reporte de review sea DIFERIDO.
- Human approval explícita es el único gate para `awaitingMerge → done`.
- Los humanos, no los agentes, deciden bloqueos (`blocked` es terminal/humano).

## Consecuencias

- La auditoría revisa evidencias, no promesas del agente.
- Los tests de la factory validan que los límites se respeten antes de que
  el run continúe (sub-issues del Orchestrator y del Worker).
