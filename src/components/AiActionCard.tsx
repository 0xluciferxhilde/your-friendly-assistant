/**
 * Inline action card rendered inside the AI chat. Lets the user fill in
 * (or confirm AI-prefilled) parameters for swap / pool / deploy and execute
 * the on-chain action without leaving the chat.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Loader2, Rocket, Wallet, X } from "lucide-react";
import { POPULAR_TOKENS, NATIVE_SENTINEL, EXPLORER_URL, isNativeAddr, errMsg } from "@/lib/litvm";
import { resolveLogo, resolveSymbol } from "@/lib/tokenMeta";
import {
  executeSwap,
  executeAddLiquidity,
  executeDeployToken,
  executeDeployContract,
  quoteSwap,
  type TxResult,
} from "@/lib/aiActions";
import type {
  Intent,
  SwapIntent,
  PoolIntent,
  DeployTokenIntent,
  DeployContractIntent,
} from "@/lib/aiIntent";

const TOKEN_OPTIONS = [
  { address: NATIVE_SENTINEL, symbol: "zkLTC" },
  ...POPULAR_TOKENS,
];

function TokenSelect({
  value,
  onChange,
  exclude,
}: {
  value: string | undefined;
  onChange: (addr: string) => void;
  exclude?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
    >
      <option value="">Select token…</option>
      {TOKEN_OPTIONS.filter((t) => t.address !== exclude).map((t) => (
        <option key={t.address} value={t.address}>
          {t.symbol}
        </option>
      ))}
    </select>
  );
}

function TokenChip({ addr }: { addr?: string }) {
  if (!addr) return <span className="text-xs text-muted-foreground">—</span>;
  const sym = isNativeAddr(addr) ? "zkLTC" : resolveSymbol(addr, "TOKEN");
  const logo = isNativeAddr(addr) ? resolveLogo("", "zkLTC") : resolveLogo(addr, sym);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-0.5 text-xs">
      {logo ? (
        <img src={logo} alt={sym} className="h-4 w-4 rounded-full" loading="lazy" />
      ) : (
        <span className="h-4 w-4 rounded-full bg-primary/30" />
      )}
      <span className="font-medium">{sym}</span>
    </span>
  );
}

type Props = {
  intent: Intent;
  walletAddr?: string;
  autoMode: boolean;
  onClose: () => void;
  onResult: (r: TxResult) => void;
  onError: (msg: string) => void;
};

export function AiActionCard({ intent, walletAddr, autoMode, onClose, onResult, onError }: Props) {
  return (
    <div className="rounded-xl border border-primary/30 bg-surface/60 p-3 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          {intent.kind === "swap" && <><ArrowDownUp className="h-3.5 w-3.5" /> Swap</>}
          {intent.kind === "pool" && <><Wallet className="h-3.5 w-3.5" /> Add Liquidity</>}
          {intent.kind === "deploy-token" && <><Rocket className="h-3.5 w-3.5" /> Deploy Token</>}
          {intent.kind === "deploy-contract" && <><Rocket className="h-3.5 w-3.5" /> Deploy {intent.contractType}</>}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {intent.kind === "swap" && (
        <SwapForm intent={intent} walletAddr={walletAddr} autoMode={autoMode} onResult={onResult} onError={onError} />
      )}
      {intent.kind === "pool" && (
        <PoolForm intent={intent} walletAddr={walletAddr} onResult={onResult} onError={onError} />
      )}
      {intent.kind === "deploy-token" && (
        <DeployTokenForm intent={intent} walletAddr={walletAddr} onResult={onResult} onError={onError} />
      )}
      {intent.kind === "deploy-contract" && (
        <DeployContractForm intent={intent} walletAddr={walletAddr} onResult={onResult} onError={onError} />
      )}
    </div>
  );
}

// ── SWAP FORM ───────────────────────────────────────────────────────────────

function SwapForm({
  intent,
  walletAddr,
  autoMode,
  onResult,
  onError,
}: {
  intent: SwapIntent;
  walletAddr?: string;
  autoMode: boolean;
  onResult: (r: TxResult) => void;
  onError: (msg: string) => void;
}) {
  const [tokenIn, setTokenIn] = useState(intent.tokenIn ?? NATIVE_SENTINEL);
  const [tokenOut, setTokenOut] = useState(intent.tokenOut ?? "");
  const [amountIn, setAmountIn] = useState(intent.amountIn ?? "");
  const [quote, setQuote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const ready = !!walletAddr && !!tokenIn && !!tokenOut && !!amountIn && +amountIn > 0;

  // Live quote
  useEffect(() => {
    let cancel = false;
    if (!ready) { setQuote(""); return; }
    quoteSwap(tokenIn, tokenOut, amountIn)
      .then((q) => !cancel && setQuote(q.amountOut))
      .catch(() => !cancel && setQuote(""));
    return () => { cancel = true; };
  }, [tokenIn, tokenOut, amountIn, ready]);

  async function run() {
    if (!walletAddr || !ready) return;
    setBusy(true);
    try {
      const r = await executeSwap({ tokenInAddr: tokenIn, tokenOutAddr: tokenOut, amountIn, walletAddr });
      onResult(r);
    } catch (e) {
      onError("Swap failed: " + errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  // Auto-execute if AI provided everything and the user has auto mode on.
  useEffect(() => {
    if (autoMode && ready && !busy && quote) {
      const t = setTimeout(() => { run(); }, 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, ready, quote]);

  const flip = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">From</label>
          <TokenSelect value={tokenIn} onChange={setTokenIn} exclude={tokenOut} />
        </div>
        <button onClick={flip} className="mb-1 rounded-md border border-border bg-background/60 p-1.5 text-primary hover:bg-primary/10" aria-label="Flip">
          <ArrowDownUp className="h-3.5 w-3.5" />
        </button>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">To</label>
          <TokenSelect value={tokenOut} onChange={setTokenOut} exclude={tokenIn} />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount In</label>
        <input
          type="number"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          placeholder="0.0"
          className="w-full rounded-lg border border-border bg-background/60 px-2 py-1.5 text-sm text-foreground focus:border-primary/60 focus:outline-none"
        />
      </div>
      {quote && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs text-primary">
          ≈ {(+quote).toFixed(6)} <TokenChip addr={tokenOut} />
        </div>
      )}
      <button
        onClick={run}
        disabled={!ready || busy || !quote}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/60 bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Swapping…" : "Confirm Swap"}
      </button>
    </div>
  );
}

// ── POOL FORM ───────────────────────────────────────────────────────────────

function PoolForm({
  intent,
  walletAddr,
  onResult,
  onError,
}: {
  intent: PoolIntent;
  walletAddr?: string;
  onResult: (r: TxResult) => void;
  onError: (msg: string) => void;
}) {
  const [tokenA, setTokenA] = useState(intent.tokenA ?? NATIVE_SENTINEL);
  const [tokenB, setTokenB] = useState(intent.tokenB ?? "");
  const [amountA, setAmountA] = useState(intent.amountA ?? "");
  const [amountB, setAmountB] = useState(intent.amountB ?? "");
  const [busy, setBusy] = useState(false);
  const ready = !!walletAddr && !!tokenA && !!tokenB && +amountA > 0 && +amountB > 0;

  async function run() {
    if (!walletAddr || !ready) return;
    setBusy(true);
    try {
      const r = await executeAddLiquidity({
        tokenAAddr: tokenA,
        tokenBAddr: tokenB,
        amountA,
        amountB,
        walletAddr,
      });
      onResult(r);
    } catch (e) {
      onError("Add liquidity failed: " + errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Token A</label>
          <TokenSelect value={tokenA} onChange={setTokenA} exclude={tokenB} />
          <input
            type="number"
            value={amountA}
            onChange={(e) => setAmountA(e.target.value)}
            placeholder="0.0"
            className="mt-1 w-full rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Token B</label>
          <TokenSelect value={tokenB} onChange={setTokenB} exclude={tokenA} />
          <input
            type="number"
            value={amountB}
            onChange={(e) => setAmountB(e.target.value)}
            placeholder="0.0"
            className="mt-1 w-full rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
          />
        </div>
      </div>
      <button
        onClick={run}
        disabled={!ready || busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/60 bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Adding…" : "Confirm Add Liquidity"}
      </button>
    </div>
  );
}

// ── DEPLOY TOKEN FORM ───────────────────────────────────────────────────────

function DeployTokenForm({
  intent,
  walletAddr,
  onResult,
  onError,
}: {
  intent: DeployTokenIntent;
  walletAddr?: string;
  onResult: (r: TxResult) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(intent.name ?? "");
  const [symbol, setSymbol] = useState(intent.symbol ?? "");
  const [supply, setSupply] = useState(intent.totalSupply ?? "");
  const [decimals, setDecimals] = useState(String(intent.decimals ?? 18));
  const [mintable, setMintable] = useState(!!intent.mintable);
  const [burnable, setBurnable] = useState(!!intent.burnable);
  const [busy, setBusy] = useState(false);
  const ready = !!walletAddr && !!name.trim() && !!symbol.trim() && /^\d+$/.test(supply) && BigInt(supply || "0") > 0n;

  async function run() {
    if (!walletAddr || !ready) return;
    setBusy(true);
    try {
      const r = await executeDeployToken({
        walletAddr,
        name,
        symbol,
        totalSupply: supply,
        decimals: parseInt(decimals, 10) || 18,
        mintable,
        burnable,
      });
      onResult(r);
    } catch (e) {
      onError("Deploy failed: " + errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Sachin)" className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs focus:border-primary/60 focus:outline-none" />
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="Symbol (e.g. SACH)" className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs focus:border-primary/60 focus:outline-none" />
        <input value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ""))} placeholder="Total supply" className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs focus:border-primary/60 focus:outline-none" />
        <input value={decimals} onChange={(e) => setDecimals(e.target.value)} placeholder="Decimals" className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs focus:border-primary/60 focus:outline-none" />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={mintable} onChange={(e) => setMintable(e.target.checked)} /> Mintable</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={burnable} onChange={(e) => setBurnable(e.target.checked)} /> Burnable</label>
      </div>
      <button
        onClick={run}
        disabled={!ready || busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/60 bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Deploying…" : "Deploy Token"}
      </button>
      <div className="text-[10px] text-muted-foreground">Fee charged in zkLTC by the LitDeX Token Factory.</div>
    </div>
  );
}

// ── DEPLOY CONTRACT FORM ────────────────────────────────────────────────────

function DeployContractForm({
  intent,
  walletAddr,
  onResult,
  onError,
}: {
  intent: DeployContractIntent;
  walletAddr?: string;
  onResult: (r: TxResult) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(intent.name ?? "");
  const [symbol, setSymbol] = useState(intent.symbol ?? "");
  const [supply, setSupply] = useState(intent.totalSupply ?? intent.maxSupply ?? "");
  const [baseURI, setBaseURI] = useState(intent.baseURI ?? "");
  const [busy, setBusy] = useState(false);
  const isNFT = intent.contractType === "NFT";
  const isERC20 = intent.contractType === "ERC20";
  const ready =
    !!walletAddr && !!name.trim() && !!symbol.trim() &&
    (isNFT ? true : /^\d+$/.test(supply || ""));

  async function run() {
    if (!walletAddr || !ready) return;
    setBusy(true);
    try {
      const r = await executeDeployContract({
        walletAddr,
        contractType: intent.contractType,
        name,
        symbol,
        totalSupply: supply,
        maxSupply: supply,
        baseURI,
      });
      onResult(r);
    } catch (e) {
      onError("Deploy failed: " + errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs focus:border-primary/60 focus:outline-none" />
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="Symbol" className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs focus:border-primary/60 focus:outline-none" />
        {(isERC20 || isNFT) && (
          <input value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ""))} placeholder={isNFT ? "Max supply" : "Total supply"} className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs focus:border-primary/60 focus:outline-none" />
        )}
        {isNFT && (
          <input value={baseURI} onChange={(e) => setBaseURI(e.target.value)} placeholder="baseURI (ipfs://…)" className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs focus:border-primary/60 focus:outline-none" />
        )}
      </div>
      {(intent.contractType === "Staking" || intent.contractType === "Vesting") && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
          {intent.contractType} requires extra parameters — please use the Forge page for full control.
        </div>
      )}
      <button
        onClick={run}
        disabled={!ready || busy || intent.contractType === "Staking" || intent.contractType === "Vesting"}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/60 bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Deploying…" : `Deploy ${intent.contractType}`}
      </button>
    </div>
  );
}

export function TxResultBubble({ result }: { result: TxResult }) {
  return (
    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
      <div className="mb-1 font-semibold text-emerald-300">✅ {result.title}</div>
      <div className="mb-2 text-emerald-200/80">{result.summary}</div>
      <div className="space-y-0.5 text-foreground/85">
        {result.details.map((d) => (
          <div key={d.label} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-mono text-[11px] truncate">{d.value}</span>
          </div>
        ))}
      </div>
      <a
        href={`${EXPLORER_URL}/tx/${result.hash}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-[11px] text-primary underline-offset-2 hover:underline"
      >
        View on LiteForge ↗
      </a>
    </div>
  );
}
