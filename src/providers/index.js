import { CLAUDE_PROVIDER } from "./claude.js";

export const PROVIDERS = [CLAUDE_PROVIDER];

export function getProvider(providerId) {
  const provider = PROVIDERS.find((candidate) => candidate.id === providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider;
}
