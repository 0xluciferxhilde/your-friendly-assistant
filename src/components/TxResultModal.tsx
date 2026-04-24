import { CheckCircle2, AlertTriangle, ExternalLink, X, Copy } from "lucide-react";
import { EXPLORER_URL, shortAddr } from "@/lib/litvm";
import { toast } from "@/hooks/use-toast";

export type TxResultKind = "ok" | "error";

export interface TxResultDetail {
  /** Label shown on the left, value on the right (monospace). */
  label: string;
  value: string;
  /** When true, render value as a copyable monospace pill. */
  copy?: boolean;
  /** When true, render value as a link to the explorer address page. */
  addressLink?: boolean;
}

export interface TxResultModalProps {
  open: boolean;
  onClose: () => void;
  kind: TxResultKind;
  /** Big title, e.g. "Swap Confirmed" */
  title: string;
  /** Subtitle line, e.g. "Your transaction has been confirmed on LitVM." */
  subtitle?: string;
  /** Optional transaction hash → renders explorer link. */
  txHash?: string;
  /** Optional list of label/value rows (sent → received, contract address, etc.). */
  details?: TxResultDetail[];
  /** Optional primary action button (besides Close). */
  primaryAction?: { label: string; onClick: () => void };
}

function copyText(value: string) {
  navigator.clipboard.writeText(value);
  toast({ title: "Copied", description: value });
}

/**
 * Themed transaction result modal. Used across Swap, Pool, Deploy, Forge, Terminal.
 * Always opens for final OK / error states; in-progress info stays inline.
 */
export function TxResultModal({
  open,
  onClose,
  kind,
  title,
  subtitle,
  txHash,
  details,
  primaryAction,
}: TxResultModalProps) {
  if (!open) return null;
  const ok = kind === "ok";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md panel-elevated p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full border ${
              ok
                ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_-2px_hsl(var(--primary)/0.5)]"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {ok ? <CheckCircle2 className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
          </div>
          <h3 className="mt-4 font-display text-2xl text-gradient-aurora">{title}</h3>
          {subtitle && (
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {(details && details.length > 0) || txHash ? (
          <div className="mt-5 space-y-2 rounded-xl border border-border bg-background/40 p-3 text-xs">
            {details?.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{d.label}</span>
                {d.copy ? (
                  <button
                    onClick={() => copyText(d.value)}
                    className="flex max-w-[60%] items-center gap-1.5 truncate rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px] text-foreground hover:border-primary/40 hover:text-primary"
                    title={d.value}
                  >
                    <span className="truncate">{shortAddr(d.value)}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                ) : d.addressLink ? (
                  <a
                    href={`${EXPLORER_URL}/address/${d.value}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    {shortAddr(d.value)}
                  </a>
                ) : (
                  <span className="text-right font-mono text-[11px] text-foreground">{d.value}</span>
                )}
              </div>
            ))}
            {txHash && (
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                <span className="text-muted-foreground">Transaction</span>
                <a
                  href={`${EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[11px] text-primary hover:bg-primary/20"
                >
                  {shortAddr(txHash)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-2">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="h-11 w-full rounded-xl border border-primary/60 bg-primary/20 text-sm font-semibold text-primary tracking-wide transition-colors hover:bg-primary/30"
            >
              {primaryAction.label}
            </button>
          )}
          <button
            onClick={onClose}
            className="h-11 w-full rounded-xl border border-border bg-surface text-sm font-medium text-foreground/80 hover:border-primary/40 hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
