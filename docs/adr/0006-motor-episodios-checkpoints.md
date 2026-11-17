# ADR 0006 — Motor de episodios en @sf/engine con checkpoints via adapter

- Estado: Aceptado (GEN-48)
- Fecha: 2026-11-10

## Contexto

GEN-16 dejo pendiente el motor real de episodios (backlog, sub-issue 1):
mover runs por la tabla de `@sf/orchestration` con checkpointing y
`TransitionEvent`. El backlog reserva la decision de persistencia a "un ADR
propio" y exige separar el nucleo del motor del backend de persistencia.

## Decision

1. El motor vive en un paquete nuevo, `packages/engine` (`@sf/engine`),
   que depende de `@sf/contracts` y `@sf/orchestration`. La tabla pura no
   absorbe dependencias: `@sf/orchestration` sigue siendo libre de
   LangGraph (mantener ADR 0003).
2. LangGraph.js 1.x (`StateGraph`) ejecuta el grafo: un canal unico
   `runtime` (Zod, validado en cada escritura), un nodo por estado activo,
   un nodo `checkpoint` y routers condicionales que derivan del estado
   vigente, nunca de la tabla viva: solo se puede avanzar a sucesores ya
   validados con `canTransition`.
3. Los handlers de los pasos son inyectados y su salida se valida con un
   esquema Zod. El paso decide `transition`, `failure` (con reparacion
   opcional respetando `ExecutionBudget`) o `pause` (suspension limpia).
4. Los checkpoints persisten el runtime completo (`EpisodeCheckpoint`)
   mediante `EpisodeCheckpointAdapter` (metodos `save`/`load`). El repo
   incluye la implementacion en memoria `InMemoryCheckpointAdapter` para
   tests. Un backend Postgres futuro (backlog sub-issue 11) implementa la
   misma interfaz sin tocar el motor.
5. La reanudacion (`resume`) valida el runtime con un `superRefine` que
   audita la cadena completa de eventos contra la tabla de transiciones;
   estados, budgets y arranques duplicados (`start` sobre episodio ya
   checkpointeado) se rechazan con errores tipados.

## Consecuencias

- El workflow no puede salir de la tabla: la legalidad se comprueba al
  escribir cada evento y al cargar cada checkpoint.
- La persistencia no se decide hoy: cambia con un adapter, sin tocar ni
  LangGraph ni los nodos.
- El motor es determinista (reloj y handlers inyectables): los tests de
  determinismo comparan ejecuciones completas entre si.
- Los timeouts por intento y la concurrencia en tiempo real podrian
  integrarse desde apps/worker y persistencia sin interferir en la tabla.
