# @sf/engine

Motor LangGraph de episodios: ejecuta un episodio de la factory recorriendo
la tabla de transiciones de `@sf/orchestration`, con guardrails, checkpoints,
errores tipados y reanudacion sin repetir pasos finalizados (GEN-48).

## Como funciona

- LangGraph.js 1.x con un unico canal `runtime` (`EpisodeRuntime`, validado
  por Zod en cada escritura, incluida la entrada de `invoke`) y un nodo por
  estado activo (`ready` ... `awaitingMerge`). Cada nodo ejecuta el handler
  inyectado para ese estado y valida su salida con `stepResultSchema`
  (`kind: transition | failure | pause`). El limite de evidencia por paso
  (110 entradas) cubre el peor caso legal de un paso de rol: 50 checks del
  rol verify + 50 evidencias de salida + 9 reintentos del gestor, de modo
  que combinar evidencias no aborte el episodio con `InvalidStepResultError`
  ni descarte evidencia de auditoria.
- La guarda pura `decideStepOutcome` convierte el resultado del paso en el
  siguiente runtime: verifica la legalidad con `canTransition` de la tabla,
  aplica el budget (`ExecutionBudget` de `@sf/contracts`), anota
  `TransitionEvent` y evidencia, y detiene el grafo en los estados
  terminales (`done`, `blocked`) y en las pausas.
- Transiciones ilegales se rechazan con `IllegalTransitionError`
  (diagnostico: origen, destino y sucesores legales); el runtime persistido
  se valida con un `superRefine` que audita toda la cadena de eventos
  contra la tabla (historia alterada => `InvalidCheckpointError`).

## Checkpoints y reanudacion

- `EpisodeCheckpointAdapter` separa el nucleo del backend de persistencia:
  los tests usan `createInMemoryCheckpointAdapter()`; un backend Postgres
  futuro solo necesita implementar `save`/`load`.
- `start()` guarda el checkpoint inicial (`ready`) antes del primer paso y
  rechaza arranques duplicados con `DuplicateEpisodeError` (reintentos
  duplicados de una cola, por ejemplo).
- `resume()` carga el checkpoint, valida el runtime completo y continua
  desde el estado actual: los pasos finalizados no se repiten porque sus
  transiciones ya estan registradas en los eventos del checkpoint. El paso
  en vuelo se vuelve a ejecutar (semantica at-least-once).
- Un handler puede devolver `{ kind: "pause", reason }` para suspender el
  episodio de forma limpia; el escape de errores inesperados queda en manos
  del caller, que decide reanudar.

## Errores tipados

`IllegalTransitionError`, `InvalidStepResultError`,
`InvalidEpisodeInputError`, `DuplicateEpisodeError`, `NoCheckpointError`,
`InvalidCheckpointError` y `MissingStepHandlerError` extienden
`EpisodeEngineError` e incluyen el `episodeId` y diagnostico concreto.

## Determinismo y alcance

Sin LLM, sin red y sin reloj implicito: el reloj se inyecta (`now`), los
handlers y el adapter se inyectan, y los tests comparan ejecuciones
completas con `toEqual` (runs identicos byte a byte entre si). Los
proveedores IA, el sandbox Docker, las integraciones con Linear/GitHub y
los merges automaticos pertenecen a otras fases del backlog.
