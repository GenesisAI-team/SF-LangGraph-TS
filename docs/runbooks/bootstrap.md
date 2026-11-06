# Runbook — Bootstrap y primeros pasos

## Requisitos

- Node 22 (salida gestionada en CI; `pnpm` requiere ≥18.36)
- pnpm ≥10.12 disponible (`corepack` o instalación manual)
- acceso a GitHub con los permisos de la org `GenesisAI-team`
- acceso a Linear (MCP) para el equipo Genesis

## Clonar y arrancar

```bash
git clone https://github.com/GenesisAI-team/SF-LangGraph-TS.git
cd SF-LangGraph-TS
pnpm install
pnpm verify   # format + lint + typecheck + test + build
```

## Ciclo de trabajo (TDD + gates)

1. Crear rama `type/GEN-N-slug` desde `main`.
2. Si la tarea es código: RED (los tests fallan), GREEN (mínimo para pasar),
   REFACTOR. Commits permitidos por cada paso.
3. `pnpm verify` en verde localmente.
4. Push de la rama y abrir PR; CI (`check "ci"`) debe estar verde.
5. Revisión humana: ≥1 aprobación y conversaciones resueltas.
6. El humano hace merge. Nunca merge automático por agentes.

## Estados y artefactos

- Ver la tabla Linear ↔ estados del run en `AGENTS.md`.
- La tabla de transición válida vive en `packages/orchestration`
  (cambios ahí primero, luego reflejar en docs).

## Protección actual de `main`

- PR obligatoria, ≥1 aprobación, checks requeridos (`ci`), `enforce_admins`,
  sin force-push ni borrado de rama.

## Cuándo bloquear y qué hacer

Bloquea (`blocked` o label Takky) y detente si: no tienes permisos para el
repo o canal correspondiente, necesitas borrar o reescribir trabajo ajeno,
o detectas que la tarea exige romper una regla de `AGENTS.md`; en ese caso
propón un ADR y espera firma humana.
