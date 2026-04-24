import { useCallback, useEffect, useState } from "react";

export type WalletTx = {
  hash: string;
  kind: "swap" | "liquidity" | "deploy" | "wrap" | "approve" | "other";
  title: string;
  subtitle?: string;
  time: number; // ms epoch
  account?: string;
};

const KEY = "litdex.tx.history.v1";
const MAX = 30;

function read(): WalletTx[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as WalletTx[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: WalletTx[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event("litdex:tx-history-update"));
  } catch {
    /* ignore */
  }
}

/** Push a tx to the local history (idempotent on hash). */
export function pushWalletTx(tx: WalletTx) {
  const list = read();
  if (list.some((t) => t.hash.toLowerCase() === tx.hash.toLowerCase())) return;
  write([tx, ...list]);
}

export function clearWalletHistory() {
  write([]);
}

/** React hook reading the persistent wallet tx history. */
export function useWalletHistory(): {
  history: WalletTx[];
  clear: () => void;
} {
  const [history, setHistory] = useState<WalletTx[]>(() => read());

  useEffect(() => {
    const handler = () => setHistory(read());
    window.addEventListener("litdex:tx-history-update", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("litdex:tx-history-update", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const clear = useCallback(() => {
    clearWalletHistory();
  }, []);

  return { history, clear };
}
