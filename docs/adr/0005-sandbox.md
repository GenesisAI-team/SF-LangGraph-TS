# ADR 0005 — Ejecución aislada por repo (sandbox)

- Estado: Aceptado (GEN-16)
- Fecha: 2026-11-01

## Contexto

Los agentes entregan código con comandos arbitrarios (tests, build, git).
Ejecutar eso sobre el entorno del humano sin contención crea riesgo real
de borrado o fuga de secretos.

## Decisión

- `@sf/sandbox` proveerá ejecución aislada por repo: worktree clonado por
  episodio, red restringida y allow-list de comandos definido de forma
  declarativa, generando logs capturables.
- La comunicación con el exterior sólo vía artefactos (commits, bundles de
  evidencias); sin acceso de escritura a Linear más allá de la issue propia.

## Consecuencias

- El costo operativo incluye provisionar y limpiar worktrees por run.
- El aislamiento hace inviable "limpiar" o borrar trabajo ajeno.
