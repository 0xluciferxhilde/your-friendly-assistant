import { useEffect, useRef, useState } from "react";
import { Search, ExternalLink, Hash, Box, Wallet, ArrowRight } from "lucide-react";
import { EXPLORER_URL, shortAddr } from "@/lib/litvm";

type Hit =
  | { kind: "tx"; value: string; url: string }
  | { kind: "address"; value: string; url: string }
  | { kind: "block"; value: string; url: string };

function detect(q: string): Hit | null {
  const v = q.trim();
  if (!v) return null;
  // tx hash: 0x + 64 hex chars
  if (/^0x[0-9a-fA-F]{64}$/.test(v)) {
    return { kind: "tx", value: v, url: `${EXPLORER_URL}/tx/${v}` };
  }
  // address: 0x + 40 hex chars
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) {
    return { kind: "address", value: v, url: `${EXPLORER_URL}/address/${v}` };
  }
  // block number: pure digits (or #digits)
  const m = v.match(/^#?(\d{1,12})$/);
  if (m) {
    return { kind: "block", value: m[1], url: `${EXPLORER_URL}/block/${m[1]}` };
  }
  return null;
}

const KIND_META: Record<Hit["kind"], { label: string; icon: typeof Hash }> = {
  tx: { label: "Transaction", icon: Hash },
  address: { label: "Address", icon: Wallet },
  block: { label: "Block", icon: Box },
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hit = detect(query);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hit) {
      window.open(hit.url, "_blank", "noopener,noreferrer");
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative hidden flex-1 max-w-xl md:block">
      <form onSubmit={onSubmit}>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search blocks, transactions, addresses…"
          className="h-10 w-full rounded-xl border border-border/60 bg-surface/60 pl-11 pr-4 text-sm placeholder:text-muted-foreground/70 backdrop-blur-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </form>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-12 z-50 panel-elevated p-2 animate-scale-in">
          {hit ? (
            <a
              href={hit.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 transition-colors hover:bg-primary/10"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                  {(() => {
                    const Icon = KIND_META[hit.kind].icon;
                    return <Icon className="h-4 w-4" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-primary">
                    Open {KIND_META[hit.kind].label}
                  </div>
                  <div className="truncate font-mono text-xs text-foreground">
                    {hit.kind === "block" ? `#${hit.value}` : shortAddr(hit.value)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary">
                Explorer <ExternalLink className="h-3 w-3" />
              </div>
            </a>
          ) : (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Paste a block number, tx hash (0x…64), or address (0x…40).
              <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground/80">
                Press <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono">Enter</kbd>
                to open in explorer
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
