# @sf/orchestration

Tablas de transicion deterministas del workflow de la factory
(READY -> PREPARING -> ... -> DONE, con REPAIRING y BLOCKED). Pureza total:
sin LangGraph, sin red, sin LLM. La incorporacion de LangGraph como motor se
hara en la sub-issue del Orchestrator; esta base es la fuente de verdad de
que transiciones son legales.

Estado: base implementada — tabla pura (`canTransition`, `assertTransition`,
`successors`) con 10 estados del workflow más `blocked`, cubierta por tests.
La integración LangGraph llega con la sub-issue del Orchestrator (ADR 0003).
