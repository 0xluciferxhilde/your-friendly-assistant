import { useEffect, useRef, useState } from "react";
import { Bell, ExternalLink, Trash2, X } from "lucide-react";
import { EXPLORER_URL, shortAddr } from "@/lib/litvm";
import { useWalletHistory, type WalletTx } from "@/hooks/useWalletHistory";

const KIND_LABEL: Record<WalletTx["kind"], string> = {
  swap: "Swap",
  liquidity: "Liquidity",
  deploy: "Deploy",
  wrap: "Wrap",
  approve: "Approve",
  other: "Tx",
};

const KIND_COLOR: Record<WalletTx["kind"], string> = {
  swap: "border-primary/40 bg-primary/10 text-primary",
  liquidity: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  deploy: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
  wrap: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  approve: "border-white/20 bg-white/5 text-white/70",
  other: "border-white/20 bg-white/5 text-white/70",
};

function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  return d + "d ago";
}

export function NotificationsButton() {
  const { history, clear } = useWalletHistory();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-surface/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {history.length > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[340px] panel-elevated p-0 animate-scale-in overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <div className="font-display text-sm text-foreground">Wallet Activity</div>
              <div className="text-[11px] text-muted-foreground">Recent LitDeX transactions</div>
            </div>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <button
                  onClick={clear}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-destructive"
                  title="Clear history"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {history.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                No transactions yet.
                <div className="mt-1 text-[10px] text-muted-foreground/70">
                  Your swaps, liquidity & deploys will appear here.
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {history.map((tx) => (
                  <li key={tx.hash} className="px-4 py-3 hover:bg-surface/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${KIND_COLOR[tx.kind]}`}
                          >
                            {KIND_LABEL[tx.kind]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(tx.time)}</span>
                        </div>
                        <div className="mt-1 truncate text-sm font-medium text-foreground">{tx.title}</div>
                        {tx.subtitle && (
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{tx.subtitle}</div>
                        )}
                      </div>
                      <a
                        href={`${EXPLORER_URL}/tx/${tx.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 font-mono text-[10px] text-primary hover:bg-primary/15"
                      >
                        {shortAddr(tx.hash)} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
