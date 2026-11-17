import { z } from "zod";

export const agentRoles = ["plan", "implement", "verify", "review", "repair"] as const;

export const agentRoleSchema = z.enum(agentRoles);

export type AgentRole = z.infer<typeof agentRoleSchema>;
