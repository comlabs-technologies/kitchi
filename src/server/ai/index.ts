import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/context";
import { callTool, listTools } from "@/server/mcp/tools";
import { DeterministicProvider } from "./deterministic";
import type { AIAnswer, AIProvider } from "./provider";

const providers: Record<string, () => AIProvider> = {
  deterministic: () => new DeterministicProvider(),
  // anthropic: () => new AnthropicProvider(process.env.ANTHROPIC_API_KEY!),
  // openai: () => new OpenAIProvider(process.env.OPENAI_API_KEY!),
};

export function getProvider(): AIProvider {
  return (providers[process.env.KITCHI_AI_PROVIDER ?? "deterministic"] ?? providers.deterministic!)();
}

export async function askKitchi(ctx: TenantContext, question: string): Promise<AIAnswer> {
  assertCan(ctx, "ai.use");
  const q = question.trim().slice(0, 300);
  if (!q) return { text: "Ask me about sales, orders or stock.", toolsUsed: [] };
  try {
    const a = await getProvider().answer({ question: q, tools: listTools(), callTool: (name, args) => callTool(ctx, name, args) });
    return { ...a, toolsUsed: [...new Set(a.toolsUsed)] };
  } catch (e) {
    const forbidden = e instanceof Error && e.name === "ForbiddenError";
    return { text: forbidden ? "Your role doesn't have access to that information." : "I couldn't answer that just now.", toolsUsed: [] };
  }
}
