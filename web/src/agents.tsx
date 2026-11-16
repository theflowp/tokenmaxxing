import type { Provider } from "./api";

/** Series colors per agent. CSS variables so they follow light/dark. */
const AGENT_COLORS: Record<string, string> = {
  claude: "var(--c-claude)",
  codex: "var(--c-codex)",
  opencode: "var(--c-blue)",
  gemini: "var(--c-green)",
  amp: "var(--c-purple)",
};
const FALLBACK = ["var(--c-teal)", "var(--c-pink)", "var(--c-yellow)", "var(--c-indigo)"];

export function agentColor(agent: string, index = 0): string {
  return AGENT_COLORS[agent] ?? FALLBACK[index % FALLBACK.length];
}

export function providerColor(provider: Provider): string {
  if (provider === "anthropic") return "var(--c-claude)";
  if (provider === "openai") return "var(--c-codex)";
  if (provider === "google") return "var(--c-blue)";
  return "var(--c-gray)";
}

/** Small marks drawn for this dashboard, not brand logos. */
export function ProviderMark({ provider, size = 14 }: { provider: Provider; size?: number }) {
  const color = providerColor(provider);
  if (provider === "anthropic") {
    // Asterisk-like burst.
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        {[0, 30, 60, 90, 120, 150].map((a) => (
          <line
            key={a}
            x1="8"
            y1="1.5"
            x2="8"
            y2="14.5"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            transform={`rotate(${a} 8 8)`}
          />
        ))}
      </svg>
    );
  }
  if (provider === "openai") {
    // Hexagonal knot.
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <polygon
          points="8,1.5 13.6,4.75 13.6,11.25 8,14.5 2.4,11.25 2.4,4.75"
          fill="none"
          stroke={color}
          strokeWidth="1.6"
        />
        <circle cx="8" cy="8" r="2.4" fill="none" stroke={color} strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}
