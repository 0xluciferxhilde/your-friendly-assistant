/**
 * LitVM-only ecosystem registry. Used by the AI assistant to answer
 * "which dapp / which contract" questions WITHOUT mentioning Uniswap,
 * PancakeSwap, or any non-LitVM project.
 *
 * Sources of truth:
 *   - DAPPS list (src/lib/litvm.ts)
 *   - On-chain contract addresses we deploy/route through
 *   - Blockscout token list at https://liteforge.explorer.caldera.xyz
 */

import {
  LITESWAP_FACTORY,
  LITESWAP_ROUTER,
  OMNIFUN_ROUTER,
  WZKLTC_ADDR,
} from "./litvm";
import { TOKEN_FACTORY_ADDRESS } from "./tokenFactory";
import { LITVM_FACTORY_ADDRESS } from "./litvmFactory";

export type EcosystemContract = {
  address: string;
  label: string;
  dapp: string;
  category: "DEX" | "Launchpad" | "Factory" | "Token" | "NFT" | "Identity" | "Infra";
  description: string;
};

/** Hardcoded LitVM-native contract registry — the ONLY source of truth for the AI. */
export const LITVM_CONTRACTS: EcosystemContract[] = [
  // DEX layer
  { address: LITESWAP_ROUTER,  label: "LiteSwap Router V2", dapp: "LiteSwap",  category: "DEX",
    description: "Native AMM router for LitVM. Handles swap + addLiquidity for zkLTC pairs." },
  { address: LITESWAP_FACTORY, label: "LiteSwap Factory",   dapp: "LiteSwap",  category: "DEX",
    description: "Pair factory for LiteSwap V2 — deploys ERC-20 LP pools." },
  { address: OMNIFUN_ROUTER,   label: "OmniFun Router",     dapp: "OmniFun",   category: "Launchpad",
    description: "OmniFun bonding curve launchpad router on LitVM." },
  { address: WZKLTC_ADDR,      label: "Wrapped zkLTC",      dapp: "LiteSwap",  category: "Token",
    description: "Canonical wzkLTC used by LiteSwap routes." },

  // Factories
  { address: TOKEN_FACTORY_ADDRESS, label: "LitDeX Token Factory", dapp: "LitDeX", category: "Factory",
    description: "ERC-20 deployer used by the LitDeX Deploy page. Fee paid in zkLTC." },
  { address: LITVM_FACTORY_ADDRESS, label: "LitDeX Master Factory", dapp: "LitDeX", category: "Factory",
    description: "Deploys ERC-20, NFT, Staking, Vesting contracts under one factory." },

  // Popular tokens (cross-referenced from Blockscout top-by-holders)
  { address: "0xFC43ABE529CDC61B7F0aa2e677451AFd83d2B304", label: "USDC",   dapp: "LitDeX",   category: "Token", description: "Primary stablecoin used in LiteSwap pools." },
  { address: "0x6858790e164a8761a711BAD1178220C5AebcF7eC", label: "PEPE",   dapp: "OmniFun",  category: "Token", description: "Top community memecoin, OmniFun routed." },
  { address: "0xFC73cdB75F37B0da829c4e54511f410D525B76b2", label: "Lester", dapp: "Lester Labs", category: "Token", description: "Lester Labs governance / utility token." },
  { address: "0x7EDB84A49Eb4077352bd6f780130E4871DaFc5bC", label: "LITOAD", dapp: "LitOracle", category: "Token", description: "LitOracle.space oracle utility token." },
  { address: "0xF143eCFE3DFEEB4ae188cA4f1c7c7ab0b5F592eb", label: "LITVM",  dapp: "LitVM Core", category: "Token", description: "Native ecosystem token." },

  // Identity / NFTs
  { address: "0x1c6C28403400c44D8D351dEaBcF7B1365F96EbF1", label: "ZNS Connect (LIT)", dapp: "ZNS",     category: "Identity", description: "On-chain naming service NFT for LitVM." },
  { address: "0x9328D0539edb2d7d54de3a12c19bD2Ba7f785eFB", label: "LITVM x ONMIFUN Genesis", dapp: "OmniFun", category: "NFT",  description: "Genesis NFT collection for LitVM x OmniFun launch." },
  { address: "0xCe29a8993CE78E420BfC7646f4AEa90B42bFd9D9", label: "LitVM x OmniHub",  dapp: "OmniHub",  category: "NFT", description: "OmniHub badge collection." },

  // Infra
  { address: "0x29307F6e3a6fa83fb61B5b90a1aD00eC6EAa8f6b", label: "OnchainGM Badge", dapp: "OnchainGM", category: "Infra", description: "Daily GM badge NFT — most-used social contract on LitVM." },
];

/** Plain-text dump of the ecosystem for the AI system prompt. */
export function formatEcosystemForPrompt(): string {
  const lines: string[] = [];
  lines.push("LitVM ecosystem dapps (the ONLY dapps you may mention):");
  lines.push("- LiteSwap   — native AMM (router 0xFa1f…4576)");
  lines.push("- OmniFun    — bonding curve launchpad (router 0xe351…FB57)");
  lines.push("- LitDeX     — deploy & manage suite (token factory 0xafb8…BE7a, master 0xdd56…f684)");
  lines.push("- Lester Labs, MidasHand, Ayni Labs, LendVault, ZNS, LitCash, AutoIncentive, OnchainGM, LitOracle, OmniHub, Penny4Thots");
  lines.push("");
  lines.push("Top contracts by usage (LitVM only — never mention Uniswap, Pancake, etc.):");
  for (const c of LITVM_CONTRACTS.slice(0, 12)) {
    lines.push(`- ${c.label} [${c.category}] @ ${c.address} via ${c.dapp}`);
  }
  return lines.join("\n");
}
