/**
 * Provider-agnostic AI boundary. An implementation receives the user's question plus the MCP tool
 * catalogue and a `callTool` function already bound to the caller's TenantContext. A real
 * provider (Anthropic / OpenAI / …) would run its tool-use loop against `tools`; it can never
 * reach data except through `callTool`, which enforces RBAC.
 */
export interface AIToolSpec {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface AIFact {
  label: string;
  value: string;
  tone?: "up" | "down" | "warn";
}

export interface AIAnswer {
  text: string;
  facts?: AIFact[];
  toolsUsed: string[];
  link?: { label: string; href: string };
}

export interface AIRequest {
  question: string;
  tools: AIToolSpec[];
  callTool: (name: string, args?: unknown) => Promise<unknown>;
}

export interface AIProvider {
  readonly id: string;
  answer(req: AIRequest): Promise<AIAnswer>;
}
