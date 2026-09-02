/**
 * Bridge prompt assembly, importable from client components.
 *
 * `lib/ai/client.ts` imports the Anthropic SDK and the Prisma client, so it
 * cannot be pulled into a client bundle. This keeps the one pure function that
 * both sides need in a file with no server-only dependencies — the two must
 * stay in step, which is why the format lives here rather than being duplicated
 * inline.
 */
export function buildBridgePromptClient(system: string, user: string): string {
  return `${system}\n\n---\n\n${user}\n\n---\nReply with the requested JSON only. No preamble, no explanation, no code fence commentary.`;
}
