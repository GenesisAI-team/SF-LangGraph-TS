# ADR 0001 — Stack base: TypeScript 6 + pnpm workspace + Vitest

- Estado: Aceptado (GEN-16)
- Fecha: 2026-11-01

## Contexto

La factory necesita una base monolenguaje, determinista y auditable, con
tooling reproducible en CI y en el local de cada agente.

## Decisión

- TypeScript 6.0.3 fijado por `catalog:` (typescript-eslint 8.72.1 soporta
  `>=4.8.4 <6.1.0`; TS 7.0.x nativo queda fuera por peer-deps).
- pnpm 10.12.1 como gestor con workspace de paquetes; versiones en el
  catálogo central de `pnpm-workspace.yaml`.
- Vitest 5.0.5 para tests; ESLint 10 flat config con reglas type-checked;
- Prettier 3.9.10 único formateador; `pnpm verify` = gates completos.

## Consecuencias

- Un solo lockfile y una sola strategy de versiones. Node version fijada
  solo en CI (22); no se usan `.nvmrc` ni `engines` por decisión del owner.
- La migración futura a TS nativo (7.x) exige reevaluar typescript-eslint.
