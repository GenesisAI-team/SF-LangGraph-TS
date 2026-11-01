# ADR 0003 — Motor de orquestación: LangGraph, tabla pura primero

- Estado: Aceptado (GEN-16)
- Fecha: 2026-11-01

## Contexto

El worker ejecuta episodios multi-agente con estados, reintentos y
interrupciones. LangGraph ofrece checkpointing y control del grafo, pero
acoplar de inicio el vocabulario de estados a una librería arriesga
deriva no auditable.

## Decisión

1. `@sf/orchestration` define primero una **tabla de transición pura y
   determinista** (`canTransition`, `assertTransition`, `successors`),
   testada sin red ni LLM. Los 10 estados del workflow más `blocked` son
   la fuente de verdad del flujo con o sin LangGraph.
2. La sub-issue del Orchestrator integrará LangGraph sobre esa tabla:
   los nodos del grafo solo pueden emitir transiciones legales.

## Consecuencias

- Cambios del flujo se hacen en la tabla y quedan cubiertos por tests.
- El grafo LangGraph no puede saltarse el gate de legalidad de transición.
- La transición de estados queda reproducible y auditable.
