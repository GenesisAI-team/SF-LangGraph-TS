# Catalogo de skillpacks (F6, GEN-16)

Contrato de un pack: cada entrada declara `id`, `origin` (repo externo +
commit revisado o `custom`), `fase` del workflow donde aplica
(PLAN | IMPLEMENT | VERIFY | REVIEW | REPAIR), y `estado`
(INSTALADO | PENDIENTE | DIFERIDO). Los packs externos solo se instalan si
su licencia es compatible (ambos origenes son MIT).

## Externos (mattpocock/skills @ a496f55, MIT)

| id | fase | estado | notas |
|---|---|---|---|
| tdd | IMPLEMENT/VERIFY | PENDIENTE | ciclo RED-GREEN-REFACTOR |
| implement | IMPLEMENT | PENDIENTE | minimo para pasar tests |
| diagnosing-bugs | REPAIR | PENDIENTE | causa raiz antes de parchear |
| code-review | REVIEW | PENDIENTE | lectura adversarial |
| pr | REVIEW | PENDIENTE | preparacion de PR |
| research | PLAN | PENDIENTE | investigacion con evidencias |
| domain-modeling | PLAN | PENDIENTE | modelado del dominio |
| codebase-design | PLAN/IMPLEMENT | PENDIENTE | decisiones de estructura |

## Externos (540/agentic-toolbox @ 0ecb4ee, MIT)

| id | fase | estado | notas |
|---|---|---|---|
| grill-me | PLAN (humano) | PENDIENTE | interrogatorio al supervisor |
| grill-with-docs | PLAN (humano) | PENDIENTE | idem con documentos |
| to-spec | PLAN (humano) | PENDIENTE | refinamiento a especificacion |
| to-tickets | PLAN (humano) | PENDIENTE | refinamiento a issues |
| gauntlet-audit | VERIFY | PENDIENTE | adaptar: auditoria con atas de seguridad |
| explain-pr | REVIEW | PENDIENTE | adaptar: generacion de texto para PR |

## Custom (autoria propia, requiere definicion)

| id | fase | estado | objetivo |
|---|---|---|---|
| plan-implementation | PLAN | PENDIENTE | refinar propuesta en plan TDD con incidencias |
| verify-acceptance | VERIFY | PENDIENTE | validar acceptanceCriteria de GEN-N |
| review-risk | REVIEW | PENDIENTE | evaluar riesgo y presupuesto (`RiskPolicy`) |
| repair-failure | REPAIR | PENDIENTE | reintento acotado, sin pasarse de presupuesto |
| browser-qa | VERIFY | DIFERIDO | QA visual via browser (puppeteer) |
| detect-spec-drift | VERIFY | PENDIENTE | alinear PR con original intent |
| review-migration | REVIEW | PENDIENTE | revisar migraciones/evolucion de repos |
