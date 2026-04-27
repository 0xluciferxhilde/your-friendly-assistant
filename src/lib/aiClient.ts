/**
 * Thin client for the LitDeX AI backend.
 * Endpoints are called directly from the browser per project owner choice.
 */

const BASE = "https://api.republicstats.xyz";

export type AiCredits = {
  free_remaining: number;
  paid_credits: number;
  can_chat: boolean;
};

export type AiChatResponse = {
  reply: string;
  free_remaining: number;
  paid_credits: number;
};

export async function getAiCredits(wallet: string): Promise<AiCredits> {
  const res = await fetch(`${BASE}/ai/credits/${wallet}`, { method: "GET" });
  if (!res.ok) throw new Error(`credits ${res.status}`);
  return res.json();
}

export async function postAiChat(
  wallet: string,
  message: string,
  context?: unknown
): Promise<AiChatResponse> {
  // The backend ignores unknown fields; we attach `context` so future
  // prompts can leverage on-chain data without a contract change.
  const body: Record<string, unknown> = { wallet, message };
  if (context) body.context = context;
  const res = await fetch(`${BASE}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`chat ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}
