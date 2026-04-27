import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Bot, Sparkles, Send, X, Loader2, Wallet } from "lucide-react";
import { TiltCard } from "./TiltCard";
import { getAiCredits, postAiChat, type AiCredits } from "@/lib/aiClient";
import { buildOnchainContext } from "@/lib/aiContext";
import { shortAddr } from "@/lib/litvm";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pending?: boolean;
};

const SUGGESTIONS = [
  "Swap 10 zkLTC to USDC",
  "What is the price of USDC?",
  "Network stats",
  "Most used DEX on LitVM",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Floating LitDeX AI assistant — bottom-right launcher + slide-in chat panel.
 * Uses TiltCard for the open panel (lightweight tilt on touch devices too).
 */
export function AiAssistant() {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState<AiCredits | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hey 👋 I'm **LitDeX AI**. Ask me to quote a swap, look up a wallet/contract, or check network stats. I can read live on-chain data from LiteForge.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Refresh credits whenever the panel opens or the wallet changes.
  useEffect(() => {
    if (!open || !address) return;
    let cancelled = false;
    getAiCredits(address)
      .then((c) => !cancelled && setCredits(c))
      .catch(() => !cancelled && setCredits(null));
    return () => { cancelled = true; };
  }, [open, address]);

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    if (!address) return;

    const userMsg: Msg = { id: uid(), role: "user", content: msg };
    const pendingId = uid();
    setMessages((m) => [
      ...m,
      userMsg,
      { id: pendingId, role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setBusy(true);

    try {
      // Enrich with on-chain context if the message mentions any 0x address.
      const context = await buildOnchainContext(msg).catch(() => null);
      const res = await postAiChat(address, msg, context ?? undefined);
      setMessages((m) =>
        m.map((x) =>
          x.id === pendingId
            ? { ...x, pending: false, content: res.reply || "(empty response)" }
            : x
        )
      );
      setCredits({
        free_remaining: res.free_remaining,
        paid_credits: res.paid_credits,
        can_chat: res.free_remaining + res.paid_credits > 0,
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // Friendlier copy for the most common failure mode (backend not deployed
      // yet / route missing / cold start). Everything else falls through.
      const friendly = /\b404\b|Not Found/i.test(raw)
        ? "AI backend reachable nahi hai abhi. Page reload karo ya thodi der baad try karo."
        : /\bFailed to fetch\b|NetworkError/i.test(raw)
          ? "Network gir gaya — internet check karke retry karo."
          : raw;
      setMessages((m) =>
        m.map((x) =>
          x.id === pendingId
            ? { ...x, pending: false, content: `⚠️ ${friendly}` }
            : x
        )
      );
    } finally {
      setBusy(false);
    }
  }

  const totalCredits =
    (credits?.free_remaining ?? 0) + (credits?.paid_credits ?? 0);
  const noCredits = !!credits && totalCredits <= 0;

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open LitDeX AI"
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "border border-primary/50 bg-background/80 text-primary backdrop-blur-xl",
          "shadow-[0_0_28px_-4px_hsl(var(--primary)/0.55)] transition-all hover:scale-105 hover:bg-primary/10",
          open && "rotate-90"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
        {!open && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/20" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[min(92vw,400px)] animate-scale-in">
          <TiltCard tiltLimit={5} scale={1.005} className="rounded-2xl">
            <div className="panel-elevated flex h-[600px] max-h-[80vh] flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-display text-sm text-gradient-aurora">
                    LitDeX AI
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {address ? shortAddr(address) : "Wallet not connected"}
                  </div>
                </div>
                {credits && (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                    {credits.free_remaining} free · {credits.paid_credits} paid
                  </span>
                )}
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
              >
                {messages.map((m) => (
                  <MessageBubble key={m.id} msg={m} />
                ))}
                {busy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Thinking…
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {messages.length <= 1 && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="chip text-[10px]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Banners */}
              {!isConnected && (
                <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  Connect wallet to use AI.
                </div>
              )}
              {noCredits && (
                <div className="mx-4 mb-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                  Out of credits — buy 100 messages for 10&nbsp;zkLTC.
                </div>
              )}

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 border-t border-border/60 bg-background/60 px-3 py-3"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    !isConnected
                      ? "Connect wallet…"
                      : noCredits
                        ? "Buy credits to continue"
                        : "Ask LitDeX AI…"
                  }
                  disabled={!isConnected || noCredits || busy}
                  className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!isConnected || noCredits || busy || !input.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/60 bg-primary/20 text-primary transition-colors hover:bg-primary/30 disabled:opacity-40"
                  aria-label="Send"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>
          </TiltCard>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-primary/40 bg-primary/15 px-3 py-2 text-sm text-foreground">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-border bg-surface px-3 py-2 text-sm text-foreground/90">
        {msg.pending ? (
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:240ms]" />
          </span>
        ) : (
          <RichText text={msg.content} />
        )}
      </div>
    </div>
  );
}

/**
 * Lightweight inline formatter — bold (**…**), inline code (`…`),
 * and 0x… addresses rendered as code chips.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|0x[a-fA-F0-9]{6,})/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-background/60 px-1 py-0.5 font-mono text-[12px] text-primary"
            >
              {p.slice(1, -1)}
            </code>
          );
        }
        if (/^0x[a-fA-F0-9]{6,}$/.test(p)) {
          return (
            <code
              key={i}
              className="rounded bg-background/60 px-1 py-0.5 font-mono text-[12px] text-primary"
            >
              {p}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
