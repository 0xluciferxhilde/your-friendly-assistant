/**
 * Token metadata registry — maps on-chain addresses to curated symbol
 * labels and remote logo URLs hosted on GitHub.
 *
 * Logos: https://raw.githubusercontent.com/0xluciferxhilde/your-friendly-assistant/main/public/logos/
 */

const LOGO_BASE =
  "https://raw.githubusercontent.com/0xluciferxhilde/your-friendly-assistant/main/public/logos";

type Meta = { symbol: string; logo: string };

// Address (lowercased) → curated metadata.
const REGISTRY: Record<string, Meta> = {
  // Native zkLTC sentinel
  "0x0000000000000000000000000000000000000000": {
    symbol: "zkLTC",
    logo: `${LOGO_BASE}/zkltc.jpg`,
  },
  // USDC
  "0xfc43abe529cdc61b7f0aa2e677451afd83d2b304": {
    symbol: "USDC",
    logo: `${LOGO_BASE}/usdc.jpg`,
  },
  // USDC.legacy
  "0xe1b51efb42cc9748c8ecf1129705f5d27901261a": {
    symbol: "USDC.legacy",
    logo: `${LOGO_BASE}/usdclegacy.jpg`,
  },
  // zkPEPE
  "0x314522dd1b3f74dd1dde03e5b5a628c28134b25d": {
    symbol: "zkPEPE",
    logo: `${LOGO_BASE}/zkpepe.jpg`,
  },
  // zkETH
  "0xaf9f497007342dd025ff696964a736ec9584c3dd": {
    symbol: "zkETH",
    logo: `${LOGO_BASE}/zketh.jpg`,
  },
  // Lester
  "0xfc73cdb75f37b0da829c4e54511f410d525b76b2": {
    symbol: "Lester",
    logo: `${LOGO_BASE}/lester.jpg`,
  },
  // PEPE
  "0x6858790e164a8761a711bad1178220c5aebcf7ec": {
    symbol: "PEPE",
    logo: `${LOGO_BASE}/pepe.jpg`,
  },
  // LITOAD
  "0x7edb84a49eb4077352bd6f780130e4871dafc5bc": {
    symbol: "LITOAD",
    logo: `${LOGO_BASE}/litoad.jpg`,
  },
  // LITVM
  "0xf143ecfe3dfeeb4ae188ca4f1c7c7ab0b5f592eb": {
    symbol: "LITVM",
    logo: `${LOGO_BASE}/litvm.jpg`,
  },
  // YURI
  "0x61346d5cbf2e66fc5c9d900c25e58816cc3b4307": {
    symbol: "YURI",
    logo: `${LOGO_BASE}/yuri.jpg`,
  },
  // CHAWLEE
  "0xff8355941adc15418ca6ad48c0a03016c40bb79a": {
    symbol: "CHAWLEE",
    logo: `${LOGO_BASE}/chawlee.jpg`,
  },
  // USDT
  "0x4af16cfb61fe9a2c6d1452d85b25e7ca49748f16": {
    symbol: "USDT",
    logo: `${LOGO_BASE}/usdt.jpg`,
  },
  // WETH
  "0xdaf8bdc2b197c2f0fab9d7359bdf482f8332b21f": {
    symbol: "WETH",
    logo: `${LOGO_BASE}/weth.jpg`,
  },
  // WBTC
  "0x3bce48a3b30414176e796af997bb1ed5e1dc5b22": {
    symbol: "WBTC",
    logo: `${LOGO_BASE}/wbtc.jpg`,
  },
};

// Symbol-based fallback (case-insensitive) for tokens not in REGISTRY by address.
const SYMBOL_LOGOS: Record<string, string> = {
  zkltc: `${LOGO_BASE}/zkltc.jpg`,
  usdc: `${LOGO_BASE}/usdc.jpg`,
  "usdc.legacy": `${LOGO_BASE}/usdclegacy.jpg`,
  usdt: `${LOGO_BASE}/usdt.jpg`,
  zketh: `${LOGO_BASE}/zketh.jpg`,
  zkpepe: `${LOGO_BASE}/zkpepe.jpg`,
  pepe: `${LOGO_BASE}/pepe.jpg`,
  lester: `${LOGO_BASE}/lester.jpg`,
  chawlee: `${LOGO_BASE}/chawlee.jpg`,
  litoad: `${LOGO_BASE}/litoad.jpg`,
  litvm: `${LOGO_BASE}/litvm.jpg`,
  yuri: `${LOGO_BASE}/yuri.jpg`,
  weth: `${LOGO_BASE}/weth.jpg`,
  wbtc: `${LOGO_BASE}/wbtc.jpg`,
};

export function resolveSymbol(address: string, fallback?: string): string {
  const meta = REGISTRY[(address || "").toLowerCase()];
  return meta?.symbol ?? fallback ?? "TOKEN";
}

export function resolveLogo(address: string, symbol?: string): string | null {
  const meta = REGISTRY[(address || "").toLowerCase()];
  if (meta) return meta.logo;
  if (symbol) {
    const hit = SYMBOL_LOGOS[symbol.toLowerCase()];
    if (hit) return hit;
  }
  return null;
}
