/**
 * On-chain context fetcher for the LitDeX AI assistant.
 *
 * - Detects 0x addresses in the user's message and pulls fresh stats
 *   (balances, tx counts, contract metadata, pool reserves) from the
 *   LiteForge RPC before sending the message to the backend.
 * - Pure helpers, no React.
 */

import { JsonRpcProvider, Contract, formatEther, formatUnits, ZeroAddress } from "ethers";
import {
  RPC_URL,
  ERC20_ABI,
  PAIR_ABI,
  FACTORY_ABI,
  ROUTER_ABI,
  LITESWAP_FACTORY,
  LITESWAP_ROUTER,
  OMNIFUN_ROUTER,
  WZKLTC_ADDR,
  POPULAR_TOKENS,
} from "./litvm";
import { resolveSymbol } from "./tokenMeta";

let provider: JsonRpcProvider | null = null;
export function aiProvider(): JsonRpcProvider {
  if (!provider) provider = new JsonRpcProvider(RPC_URL);
  return provider;
}

export type WalletStats = {
  address: string;
  nativeBalance: string;        // formatted zkLTC
  txCount: number;
  tokens: { symbol: string; address: string; balance: string }[];
  lpPositions: { pair: string; balance: string }[];
};

export type ContractStats = {
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;
  isErc20: boolean;
  isPair: boolean;
  pairToken0?: string;
  pairToken1?: string;
  reserve0?: string;
  reserve1?: string;
};

export type NetworkStats = {
  latestBlock: number;
  gasPriceGwei: string;
  liteSwapTxCount: number;
  omniFunTxCount: number;
  topDex: "LitDeX" | "OmniFun";
};

const ADDR_RE = /0x[a-fA-F0-9]{40}/g;
export function extractAddresses(msg: string): string[] {
  return Array.from(new Set((msg.match(ADDR_RE) ?? []).map((a) => a)));
}

/** True if address is a deployed contract (has bytecode). */
async function isContract(addr: string): Promise<boolean> {
  try {
    const code = await aiProvider().getCode(addr);
    return code && code !== "0x";
  } catch {
    return false;
  }
}

export async function fetchWalletStats(addr: string): Promise<WalletStats> {
  const p = aiProvider();
  const [bal, txc] = await Promise.all([
    p.getBalance(addr).catch(() => 0n),
    p.getTransactionCount(addr).catch(() => 0),
  ]);

  const tokens = await Promise.all(
    POPULAR_TOKENS.map(async (t) => {
      try {
        const c = new Contract(t.address, ERC20_ABI, p);
        const [raw, dec] = await Promise.all([c.balanceOf(addr), c.decimals()]);
        const balance = formatUnits(raw, Number(dec));
        if (Number(balance) === 0) return null;
        return { symbol: resolveSymbol(t.address, t.symbol), address: t.address, balance };
      } catch {
        return null;
      }
    })
  );

  return {
    address: addr,
    nativeBalance: formatEther(bal),
    txCount: Number(txc),
    tokens: tokens.filter(Boolean) as WalletStats["tokens"],
    lpPositions: [], // populated lazily on demand to keep payload small
  };
}

export async function fetchContractStats(addr: string): Promise<ContractStats> {
  const p = aiProvider();
  const stats: ContractStats = { address: addr, isErc20: false, isPair: false };

  // Try ERC-20 surface
  try {
    const c = new Contract(addr, ERC20_ABI, p);
    const [name, symbol, decimals, supply] = await Promise.all([
      c.name().catch(() => undefined),
      c.symbol().catch(() => undefined),
      c.decimals().catch(() => undefined),
      c.totalSupply().catch(() => undefined),
    ]);
    if (symbol || name) {
      stats.isErc20 = true;
      stats.name = name;
      stats.symbol = symbol;
      stats.decimals = decimals != null ? Number(decimals) : undefined;
      stats.totalSupply =
        supply != null && decimals != null
          ? formatUnits(supply, Number(decimals))
          : undefined;
    }
  } catch { /* ignore */ }

  // Try pair surface (token0/token1/getReserves)
  try {
    const pair = new Contract(addr, PAIR_ABI, p);
    const [t0, t1, reserves] = await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves(),
    ]);
    stats.isPair = true;
    stats.pairToken0 = t0;
    stats.pairToken1 = t1;
    stats.reserve0 = reserves[0].toString();
    stats.reserve1 = reserves[1].toString();
  } catch { /* not a pair */ }

  return stats;
}

export async function fetchNetworkStats(): Promise<NetworkStats> {
  const p = aiProvider();
  const [latest, fee, liteTxs, omniTxs] = await Promise.all([
    p.getBlockNumber(),
    p.getFeeData(),
    p.getTransactionCount(LITESWAP_ROUTER).catch(() => 0),
    p.getTransactionCount(OMNIFUN_ROUTER).catch(() => 0),
  ]);
  const gasGwei = fee.gasPrice ? (Number(fee.gasPrice) / 1e9).toFixed(3) : "0";
  return {
    latestBlock: latest,
    gasPriceGwei: gasGwei,
    liteSwapTxCount: Number(liteTxs),
    omniFunTxCount: Number(omniTxs),
    topDex: Number(liteTxs) >= Number(omniTxs) ? "LitDeX" : "OmniFun",
  };
}

/** Quote `amountIn` of `tokenIn` → `tokenOut` via LiteSwap router. */
export async function quoteSwap(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<{ amountOut: string; symbolIn: string; symbolOut: string } | null> {
  try {
    const p = aiProvider();
    const router = new Contract(LITESWAP_ROUTER, ROUTER_ABI, p);
    const inAddr = tokenIn.toLowerCase() === "zkltc" ? WZKLTC_ADDR : tokenIn;
    const outAddr = tokenOut.toLowerCase() === "zkltc" ? WZKLTC_ADDR : tokenOut;
    const tIn = new Contract(inAddr, ERC20_ABI, p);
    const tOut = new Contract(outAddr, ERC20_ABI, p);
    const [decIn, decOut, symIn, symOut] = await Promise.all([
      tIn.decimals(),
      tOut.decimals(),
      tIn.symbol().catch(() => "TOKEN"),
      tOut.symbol().catch(() => "TOKEN"),
    ]);
    const raw = BigInt(Math.floor(Number(amountIn) * 10 ** Number(decIn)));
    const amounts: bigint[] = await router.getAmountsOut(raw, [inAddr, outAddr]);
    return {
      amountOut: formatUnits(amounts[amounts.length - 1], Number(decOut)),
      symbolIn: symIn,
      symbolOut: symOut,
    };
  } catch {
    return null;
  }
}

/** Fetch reserves for a pair so we can derive a price. */
export async function fetchPairReserves(tokenA: string, tokenB: string) {
  try {
    const p = aiProvider();
    const factory = new Contract(LITESWAP_FACTORY, FACTORY_ABI, p);
    const pairAddr = await factory.getPair(tokenA, tokenB);
    if (!pairAddr || pairAddr === ZeroAddress) return null;
    const pair = new Contract(pairAddr, PAIR_ABI, p);
    const [t0, reserves] = await Promise.all([pair.token0(), pair.getReserves()]);
    const aIs0 = t0.toLowerCase() === tokenA.toLowerCase();
    return {
      pairAddress: pairAddr as string,
      reserveA: (aIs0 ? reserves[0] : reserves[1]).toString(),
      reserveB: (aIs0 ? reserves[1] : reserves[0]).toString(),
    };
  } catch {
    return null;
  }
}

/**
 * Build a compact JSON context blob for any 0x addresses in the message.
 * Sent to the AI backend so the model can reason about live data.
 */
export async function buildOnchainContext(message: string) {
  const addrs = extractAddresses(message);
  if (addrs.length === 0) return null;

  const detail = await Promise.all(
    addrs.map(async (a) => {
      const contract = await isContract(a);
      if (contract) {
        return { address: a, kind: "contract" as const, data: await fetchContractStats(a) };
      }
      return { address: a, kind: "wallet" as const, data: await fetchWalletStats(a) };
    })
  );

  const network = await fetchNetworkStats().catch(() => null);
  return { addresses: detail, network };
}
