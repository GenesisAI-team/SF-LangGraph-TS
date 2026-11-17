# @sf/orchestration

Tablas de transicion deterministas del workflow de la factory
(READY -> PREPARING -> ... -> DONE, con REPAIRING y BLOCKED). Pureza total:
sin LangGraph, sin red, sin LLM. Esta base es la fuente de verdad de que
transiciones son legales.

Estado: base implementada — tabla pura (`canTransition`, `assertTransition`,
`successors`) con 10 estados del workflow más `blocked`, cubierta por tests.
El motor LangGraph sobre esta tabla llego en GEN-48 y vive en `@sf/engine`
(`packages/engine`), no aqui.
