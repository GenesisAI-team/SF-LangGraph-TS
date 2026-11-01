# ADR 0002 — Contratos: esquemas Zod en @sf/contracts

- Estado: Aceptado (GEN-16)
- Fecha: 2026-11-01

## Contexto

Toda la comunicación entre humanos, agents y capas pasa por artefactos
(envelope de issue, eventos de transición, políticas, evidencias) que deben
ser verificables y auditables.

## Decisión

- `@sf/contracts` es el único paquete que define schema y tipo: Zod 4.6.7
  para parseo/tipado derivado; sin lógica de negocio.
- `IssueEnvelope` (issueId GEN-N, repo owner/name, branch canónica, título,
  objetivo, acceptanceCriteria no vacía, riskTier, budget) es la puerta de
  entrada de todo run.
- `RunState` fija el vocabulario de estados; `TransitionEvent`, `RiskPolicy`
  y `EvidenceBundle` delimitan el resto del vocabulario compartido.

## Consecuencias

- Los demás paquetes dependen de contracts, nunca al revés.
- Los schemas son `strict`: propiedades desconocidas se rechazan (fail-fast).
- La divergencia tipo/schema es imposible porque el tipo deriva del schema.
