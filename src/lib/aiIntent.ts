/**
 * Local intent parser for the AI assistant. Runs BEFORE the backend call so
 * the UI can pop up an inline action card (swap form / pool form / deploy form)
 * regardless of what the model says.
 *
 * Pure functions — no React, no network. Safe to call from anywhere.
 */

import { POPULAR_TOKENS, NATIVE_SENTINEL, type Token } from "./litvm";
import { resolveSymbol } from "./tokenMeta";

export type SwapIntent = {
  kind: "swap";
  tokenIn?: string;   // address or NATIVE_SENTINEL
  tokenOut?: string;
  amountIn?: string;
  symbolIn?: string;
  symbolOut?: string;
};

export type PoolIntent = {
  kind: "pool";
  tokenA?: string;
  tokenB?: string;
  amountA?: string;
  amountB?: string;
  symbolA?: string;
  symbolB?: string;
};

export type DeployTokenIntent = {
  kind: "deploy-token";
  name?: string;
  symbol?: string;
  totalSupply?: string;
  decimals?: number;
  mintable?: boolean;
  burnable?: boolean;
  pausable?: boolean;
};

export type DeployContractIntent = {
  kind: "deploy-contract";
  contractType: "ERC20" | "NFT" | "Staking" | "Vesting";
  name?: string;
  symbol?: string;
  totalSupply?: string;
  baseURI?: string;
  maxSupply?: string;
};

export type Intent = SwapIntent | PoolIntent | DeployTokenIntent | DeployContractIntent;

/** Find a token by symbol (case-insensitive), or by 0x address. */
export function findToken(query: string): { address: string; symbol: string } | null {
  if (!query) return null;
  const q = query.trim();
  if (/^zkltc$/i.test(q) || /^native$/i.test(q)) {
    return { address: NATIVE_SENTINEL, symbol: "zkLTC" };
  }
  // Address?
  if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
    return { address: q, symbol: resolveSymbol(q, "TOKEN") };
  }
  // Symbol match
  const lower = q.toLowerCase();
  for (const t of POPULAR_TOKENS as Token[]) {
    if (t.symbol.toLowerCase() === lower) return { address: t.address, symbol: t.symbol };
  }
  // Loose contains match (e.g., "usd" → first USDC)
  for (const t of POPULAR_TOKENS as Token[]) {
    if (t.symbol.toLowerCase().includes(lower)) return { address: t.address, symbol: t.symbol };
  }
  return null;
}

const SWAP_RE =
  /\bswap\b\s*(?<amt>[\d.]+)?\s*(?<inSym>[a-zA-Z0-9.]+)?\s*(?:to|for|->|→|into)\s*(?<outSym>[a-zA-Z0-9.]+)/i;

const POOL_RE =
  /\b(?:add|provide|create)\s+liquidity|\bpool\b/i;

const DEPLOY_TOKEN_RE =
  /\b(?:deploy|launch|create|mint)\b.*\b(?:token|erc[- ]?20|coin)\b/i;

const DEPLOY_NFT_RE = /\b(?:deploy|launch|create)\b.*\b(?:nft|erc[- ]?721|collection)\b/i;
const DEPLOY_STAKING_RE = /\b(?:deploy|create)\b.*\b(?:staking)\b/i;
const DEPLOY_VESTING_RE = /\b(?:deploy|create)\b.*\b(?:vesting)\b/i;

function pickField(re: RegExp, msg: string): string | undefined {
  const m = msg.match(re);
  return m?.[1];
}

export function parseIntent(message: string): Intent | null {
  const msg = message.trim();
  if (!msg) return null;

  // ── SWAP ────────────────────────────────────────────────────────────────
  const swapM = msg.match(SWAP_RE);
  if (swapM?.groups) {
    const amt = swapM.groups.amt;
    const inT = swapM.groups.inSym ? findToken(swapM.groups.inSym) : null;
    const outT = swapM.groups.outSym ? findToken(swapM.groups.outSym) : null;
    return {
      kind: "swap",
      amountIn: amt,
      tokenIn: inT?.address,
      tokenOut: outT?.address,
      symbolIn: inT?.symbol,
      symbolOut: outT?.symbol,
    };
  }
  // bare "swap" with no details → still trigger empty form
  if (/^\s*swap\b/i.test(msg)) {
    return { kind: "swap" };
  }

  // ── POOL ────────────────────────────────────────────────────────────────
  if (POOL_RE.test(msg)) {
    // Try "add liquidity TOK_A + TOK_B" or "TOK_A/TOK_B"
    const pairM = msg.match(/([a-zA-Z0-9.]+)\s*(?:\/|\+|and|with|&)\s*([a-zA-Z0-9.]+)/);
    const a = pairM ? findToken(pairM[1]) : null;
    const b = pairM ? findToken(pairM[2]) : null;
    return {
      kind: "pool",
      tokenA: a?.address,
      tokenB: b?.address,
      symbolA: a?.symbol,
      symbolB: b?.symbol,
    };
  }

  // ── DEPLOY NFT / STAKING / VESTING ──────────────────────────────────────
  if (DEPLOY_NFT_RE.test(msg)) {
    const name = pickField(/name\s*[:=]?\s*"?([\w \-]+)"?/i, msg);
    const symbol = pickField(/symbol\s*[:=]?\s*"?([\w]+)"?/i, msg);
    const supply = pickField(/(?:max\s*)?supply\s*[:=]?\s*([\d_,]+)/i, msg);
    return { kind: "deploy-contract", contractType: "NFT", name, symbol, maxSupply: supply };
  }
  if (DEPLOY_STAKING_RE.test(msg)) {
    return { kind: "deploy-contract", contractType: "Staking" };
  }
  if (DEPLOY_VESTING_RE.test(msg)) {
    return { kind: "deploy-contract", contractType: "Vesting" };
  }

  // ── DEPLOY TOKEN ────────────────────────────────────────────────────────
  if (DEPLOY_TOKEN_RE.test(msg) || /\bdeploy\b\s+(?:a\s+)?(?:token\s+)?(?:named\s+|name\s+)?[\w]+\s+with/i.test(msg)) {
    // "deploy token name sachin with 5 supply" / "deploy SACH with 1000 supply"
    const nameM = msg.match(/\bname[d]?\s+([\w\-]+)/i)
                 ?? msg.match(/\btoken\s+([\w\-]+)/i)
                 ?? msg.match(/\bdeploy\s+([\w\-]+)\s+with/i);
    const symM = msg.match(/symbol\s+([\w]+)/i) ?? msg.match(/\(([A-Z0-9]{2,8})\)/);
    const supplyM = msg.match(/([\d_,]+)\s*(?:total\s+)?supply/i)
                  ?? msg.match(/supply\s+(?:of\s+)?([\d_,]+)/i);
    const decM = msg.match(/(\d{1,2})\s*decimals?/i);
    return {
      kind: "deploy-token",
      name: nameM?.[1],
      symbol: symM?.[1]?.toUpperCase() ?? nameM?.[1]?.slice(0, 6).toUpperCase(),
      totalSupply: supplyM?.[1]?.replace(/[,_]/g, ""),
      decimals: decM ? parseInt(decM[1], 10) : 18,
      mintable: /mintable/i.test(msg),
      burnable: /burnable/i.test(msg),
      pausable: /pausable/i.test(msg),
    };
  }

  return null;
}
