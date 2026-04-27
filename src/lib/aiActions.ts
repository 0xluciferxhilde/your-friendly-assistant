/**
 * On-chain action executor for the AI assistant.
 *
 * Mirrors the production code paths used in:
 *   - src/pages/Swap.tsx       → swap (LiteSwap / OmniFun)
 *   - src/pages/Pool.tsx       → addLiquidity
 *   - src/pages/Deploy.tsx     → token factory deployToken
 *   - src/pages/Forge.tsx      → master factory deployERC20 / deployNFT / etc.
 *
 * Each function returns { hash, summary, details } so the chat can render a
 * TxResultModal-style success message inline.
 */

import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  formatUnits,
  parseUnits,
} from "ethers";
import {
  ERC20_ABI,
  ROUTER_ABI,
  RPC_URL,
  WZKLTC_ADDR,
  LITESWAP_ROUTER,
  OMNIFUN_ROUTER,
  isNativeAddr,
  pickRouter,
  SWAP_DEADLINE_SEC,
  errMsg,
} from "./litvm";
import { TOKEN_FACTORY_ADDRESS, TOKEN_FACTORY_ABI } from "./tokenFactory";
import {
  LITVM_FACTORY_ADDRESS,
  LITVM_FACTORY_ABI,
  FactoryContractType,
} from "./litvmFactory";
import { resolveSymbol } from "./tokenMeta";
import { pushWalletTx } from "@/hooks/useWalletHistory";

const ROUTER_SWAP_ABI = [
  "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
  "function swapExactZKLTCForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)",
  "function swapExactTokensForZKLTC(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
] as const;

const readProvider = new JsonRpcProvider(RPC_URL);

function getEth(): unknown {
  return (window as unknown as { ethereum?: unknown }).ethereum ?? null;
}

async function getSigner() {
  const eth = getEth();
  if (!eth) throw new Error("No wallet detected");
  const provider = new BrowserProvider(eth as never);
  const signer = await provider.getSigner();
  return signer;
}

export type TokenMetaLite = { address: string; symbol: string; decimals: number; balance: string };

export async function loadTokenMeta(addr: string, owner?: string): Promise<TokenMetaLite> {
  if (isNativeAddr(addr)) {
    const bal = owner ? await readProvider.getBalance(owner).catch(() => 0n) : 0n;
    return { address: "NATIVE", symbol: "zkLTC", decimals: 18, balance: formatEther(bal) };
  }
  const c = new Contract(addr, ERC20_ABI, readProvider);
  const [sym, dec, bal] = await Promise.all([
    c.symbol().catch(() => "TOKEN"),
    c.decimals().catch(() => 18),
    owner ? c.balanceOf(owner).catch(() => 0n) : Promise.resolve(0n),
  ]);
  const decimals = Number(dec);
  return {
    address: addr,
    symbol: resolveSymbol(addr, String(sym)),
    decimals,
    balance: formatUnits(bal as bigint, decimals),
  };
}

/** Quote a swap output amount via the LiteSwap/OmniFun router. */
export async function quoteSwap(
  tokenInAddr: string,
  tokenOutAddr: string,
  amountIn: string
): Promise<{ amountOut: string; routerKey: "liteswap" | "omnifun" }> {
  const routerKey = pickRouter(
    isNativeAddr(tokenInAddr) ? undefined : tokenInAddr,
    isNativeAddr(tokenOutAddr) ? undefined : tokenOutAddr
  );
  const routerAddr = routerKey === "omnifun" ? OMNIFUN_ROUTER : LITESWAP_ROUTER;
  const router = new Contract(routerAddr, ROUTER_SWAP_ABI, readProvider);
  const inA = isNativeAddr(tokenInAddr) ? WZKLTC_ADDR : tokenInAddr;
  const outA = isNativeAddr(tokenOutAddr) ? WZKLTC_ADDR : tokenOutAddr;
  const inMeta = await loadTokenMeta(tokenInAddr);
  const outMeta = await loadTokenMeta(tokenOutAddr);
  const amounts: bigint[] = await router.getAmountsOut(
    parseUnits(amountIn || "0", inMeta.decimals),
    [inA, outA]
  );
  return {
    amountOut: formatUnits(amounts[amounts.length - 1], outMeta.decimals),
    routerKey,
  };
}

export type TxResult = {
  hash: string;
  title: string;
  summary: string;
  details: { label: string; value: string }[];
};

/** Approve an ERC-20 spend if allowance < amount. No-op for native. */
async function ensureAllowance(
  tokenAddr: string,
  decimals: number,
  amount: string,
  owner: string,
  spender: string
) {
  if (isNativeAddr(tokenAddr)) return;
  const wei = parseUnits(amount, decimals);
  const reader = new Contract(tokenAddr, ERC20_ABI, readProvider);
  const current: bigint = await reader.allowance(owner, spender);
  if (current >= wei) return;
  const signer = await getSigner();
  const c = new Contract(tokenAddr, ERC20_ABI, signer);
  const tx = await c.approve(spender, wei);
  await tx.wait();
}

// ── SWAP ────────────────────────────────────────────────────────────────────

export async function executeSwap(opts: {
  tokenInAddr: string;
  tokenOutAddr: string;
  amountIn: string;
  walletAddr: string;
  slippagePct?: number;
}): Promise<TxResult> {
  const slippage = opts.slippagePct ?? 0.5;
  const inMeta = await loadTokenMeta(opts.tokenInAddr, opts.walletAddr);
  const outMeta = await loadTokenMeta(opts.tokenOutAddr);
  const { amountOut, routerKey } = await quoteSwap(
    opts.tokenInAddr,
    opts.tokenOutAddr,
    opts.amountIn
  );
  const routerAddr = routerKey === "omnifun" ? OMNIFUN_ROUTER : LITESWAP_ROUTER;

  // Approve if needed
  await ensureAllowance(opts.tokenInAddr, inMeta.decimals, opts.amountIn, opts.walletAddr, routerAddr);

  const signer = await getSigner();
  const router = new Contract(routerAddr, ROUTER_SWAP_ABI, signer);
  const inWei = parseUnits(opts.amountIn, inMeta.decimals);
  const outWei = parseUnits(amountOut, outMeta.decimals);
  const minOut = outWei - (outWei * BigInt(Math.floor(slippage * 100))) / 10000n;
  const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SEC;
  const inA = isNativeAddr(opts.tokenInAddr) ? WZKLTC_ADDR : opts.tokenInAddr;
  const outA = isNativeAddr(opts.tokenOutAddr) ? WZKLTC_ADDR : opts.tokenOutAddr;
  const path = [inA, outA];
  const isOmni = routerKey === "omnifun";
  const fnNativeIn = isOmni ? "swapExactETHForTokens" : "swapExactZKLTCForTokens";
  const fnNativeOut = isOmni ? "swapExactTokensForETH" : "swapExactTokensForZKLTC";

  let tx;
  if (isNativeAddr(opts.tokenInAddr)) {
    tx = await router[fnNativeIn](minOut, path, opts.walletAddr, deadline, { value: inWei });
  } else if (isNativeAddr(opts.tokenOutAddr)) {
    tx = await router[fnNativeOut](inWei, minOut, path, opts.walletAddr, deadline);
  } else {
    tx = await router.swapExactTokensForTokens(inWei, minOut, path, opts.walletAddr, deadline);
  }
  const receipt = await tx.wait();
  const hash = receipt?.hash ?? tx.hash;

  pushWalletTx({
    hash,
    kind: "swap",
    title: `Swapped ${inMeta.symbol} → ${outMeta.symbol}`,
    subtitle: `${(+opts.amountIn).toFixed(4)} ${inMeta.symbol} → ${(+amountOut).toFixed(4)} ${outMeta.symbol} · ${routerKey === "omnifun" ? "OmniFun" : "LitDeX"}`,
    time: Date.now(),
    account: opts.walletAddr,
  });

  return {
    hash,
    title: "Swap Confirmed",
    summary: `${(+opts.amountIn).toFixed(4)} ${inMeta.symbol} → ${(+amountOut).toFixed(4)} ${outMeta.symbol}`,
    details: [
      { label: "Sent", value: `${opts.amountIn} ${inMeta.symbol}` },
      { label: "Received", value: `${(+amountOut).toFixed(6)} ${outMeta.symbol}` },
      { label: "Router", value: routerKey === "omnifun" ? "OmniFun" : "LiteSwap" },
    ],
  };
}

// ── ADD LIQUIDITY ───────────────────────────────────────────────────────────

export async function executeAddLiquidity(opts: {
  tokenAAddr: string;
  tokenBAddr: string;
  amountA: string;
  amountB: string;
  walletAddr: string;
}): Promise<TxResult> {
  const a = await loadTokenMeta(opts.tokenAAddr, opts.walletAddr);
  const b = await loadTokenMeta(opts.tokenBAddr, opts.walletAddr);
  const aWei = parseUnits(opts.amountA, a.decimals);
  const bWei = parseUnits(opts.amountB, b.decimals);
  const slippageBps = 500n;
  const aMin = aWei - (aWei * slippageBps) / 10000n;
  const bMin = bWei - (bWei * slippageBps) / 10000n;
  const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SEC;

  // Approvals for any non-native side
  await ensureAllowance(opts.tokenAAddr, a.decimals, opts.amountA, opts.walletAddr, LITESWAP_ROUTER);
  await ensureAllowance(opts.tokenBAddr, b.decimals, opts.amountB, opts.walletAddr, LITESWAP_ROUTER);

  const signer = await getSigner();
  const router = new Contract(LITESWAP_ROUTER, ROUTER_ABI, signer);
  let tx;
  if (isNativeAddr(opts.tokenAAddr) && !isNativeAddr(opts.tokenBAddr)) {
    tx = await router.addLiquidityZKLTC(opts.tokenBAddr, bWei, bMin, aMin, opts.walletAddr, deadline, { value: aWei });
  } else if (isNativeAddr(opts.tokenBAddr) && !isNativeAddr(opts.tokenAAddr)) {
    tx = await router.addLiquidityZKLTC(opts.tokenAAddr, aWei, aMin, bMin, opts.walletAddr, deadline, { value: bWei });
  } else if (!isNativeAddr(opts.tokenAAddr) && !isNativeAddr(opts.tokenBAddr)) {
    tx = await router.addLiquidity(opts.tokenAAddr, opts.tokenBAddr, aWei, bWei, aMin, bMin, opts.walletAddr, deadline);
  } else {
    throw new Error("Cannot add zkLTC + zkLTC");
  }
  const receipt = await tx.wait();
  const hash = receipt?.hash ?? tx.hash;

  pushWalletTx({
    hash,
    kind: "liquidity",
    title: `Added Liquidity ${a.symbol}/${b.symbol}`,
    subtitle: `${(+opts.amountA).toFixed(4)} ${a.symbol} + ${(+opts.amountB).toFixed(4)} ${b.symbol}`,
    time: Date.now(),
    account: opts.walletAddr,
  });

  return {
    hash,
    title: "Liquidity Added",
    summary: `${a.symbol}/${b.symbol} pool funded`,
    details: [
      { label: a.symbol, value: `${opts.amountA}` },
      { label: b.symbol, value: `${opts.amountB}` },
      { label: "Router", value: "LiteSwap" },
    ],
  };
}

// ── DEPLOY ERC-20 (Token Factory) ───────────────────────────────────────────

export async function executeDeployToken(opts: {
  walletAddr: string;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals?: number;
  mintable?: boolean;
  burnable?: boolean;
  pausable?: boolean;
}): Promise<TxResult & { tokenAddr?: string }> {
  const signer = await getSigner();
  const factory = new Contract(TOKEN_FACTORY_ADDRESS, TOKEN_FACTORY_ABI, signer);
  const fee: bigint = await factory.deployFee();
  const tx = await factory.deployToken(
    opts.name.trim(),
    opts.symbol.trim(),
    opts.decimals ?? 18,
    BigInt(opts.totalSupply),
    !!opts.mintable,
    !!opts.burnable,
    !!opts.pausable,
    { value: fee }
  );
  const receipt = await tx.wait();
  const hash = receipt?.hash ?? tx.hash;
  let tokenAddr: string | undefined;
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === "TokenDeployed") {
        tokenAddr = parsed.args[0] as string;
        break;
      }
    } catch { /* ignore */ }
  }

  pushWalletTx({
    hash,
    kind: "deploy",
    title: `Deployed ${opts.symbol}`,
    subtitle: `${opts.name} · ${Number(opts.totalSupply).toLocaleString()} supply`,
    time: Date.now(),
    account: opts.walletAddr,
  });

  return {
    hash,
    tokenAddr,
    title: "Token Deployed",
    summary: `${opts.symbol} live on LitVM`,
    details: [
      { label: "Name", value: opts.name },
      { label: "Symbol", value: opts.symbol },
      { label: "Supply", value: Number(opts.totalSupply).toLocaleString() },
      ...(tokenAddr ? [{ label: "Address", value: tokenAddr }] : []),
      { label: "Fee", value: `${formatUnits(fee, 18)} zkLTC` },
    ],
  };
}

// ── DEPLOY OTHER CONTRACTS (Master Factory) ─────────────────────────────────

export async function executeDeployContract(opts: {
  walletAddr: string;
  contractType: "ERC20" | "NFT" | "Staking" | "Vesting";
  // ERC20
  name?: string;
  symbol?: string;
  totalSupply?: string;
  decimals?: number;
  mintable?: boolean;
  burnable?: boolean;
  pausable?: boolean;
  // NFT
  baseURI?: string;
  maxSupply?: string;
  mintPrice?: string;
  publicMint?: boolean;
}): Promise<TxResult> {
  const signer = await getSigner();
  const factory = new Contract(LITVM_FACTORY_ADDRESS, LITVM_FACTORY_ABI as never, signer);
  const fee: bigint = await factory.deployFee();
  let tx;
  if (opts.contractType === "ERC20") {
    tx = await factory.deployERC20(
      opts.name ?? "MyToken",
      opts.symbol ?? "MYT",
      opts.decimals ?? 18,
      BigInt(opts.totalSupply ?? "1000000"),
      !!opts.mintable,
      !!opts.burnable,
      !!opts.pausable,
      { value: fee }
    );
  } else if (opts.contractType === "NFT") {
    tx = await factory.deployNFT(
      opts.name ?? "MyNFT",
      opts.symbol ?? "NFT",
      opts.baseURI ?? "",
      BigInt(opts.maxSupply ?? "10000"),
      parseUnits(opts.mintPrice ?? "0", 18),
      opts.publicMint ?? true,
      { value: fee }
    );
  } else {
    throw new Error(`${opts.contractType} deploy via AI not yet supported — open the Forge page.`);
  }
  const receipt = await tx.wait();
  const hash = receipt?.hash ?? tx.hash;
  let contractAddr: string | undefined;
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === "ContractDeployed") {
        contractAddr = parsed.args[0] as string;
        break;
      }
    } catch { /* ignore */ }
  }
  pushWalletTx({
    hash,
    kind: "deploy",
    title: `Deployed ${opts.contractType}`,
    subtitle: opts.symbol ?? opts.name ?? "Custom contract",
    time: Date.now(),
    account: opts.walletAddr,
  });
  return {
    hash,
    title: `${opts.contractType} Deployed`,
    summary: `${opts.symbol ?? opts.name ?? "Contract"} live on LitVM`,
    details: [
      { label: "Type", value: opts.contractType },
      ...(opts.name ? [{ label: "Name", value: opts.name }] : []),
      ...(opts.symbol ? [{ label: "Symbol", value: opts.symbol }] : []),
      ...(contractAddr ? [{ label: "Address", value: contractAddr }] : []),
      { label: "Fee", value: `${formatUnits(fee, 18)} zkLTC` },
    ],
  };
}

export { errMsg, FactoryContractType };
