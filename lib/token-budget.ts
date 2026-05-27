const CHARS_PER_TOKEN = 3;
const MAX_CONTEXT_TOKENS = 6000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function truncateToTokenBudget(
  text: string,
  maxTokens: number
): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return (
    text.slice(0, maxChars) +
    "\n\n[... contenido truncado por limite de contexto ...]"
  );
}

export function enforceTokenBudget(
  systemPrompt: string,
  budget: number = MAX_CONTEXT_TOKENS
): string {
  const tokens = estimateTokens(systemPrompt);
  if (tokens <= budget) return systemPrompt;
  return truncateToTokenBudget(systemPrompt, budget);
}
