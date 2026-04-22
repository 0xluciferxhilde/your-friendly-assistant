import { ArrowLeftRight, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { JsonRpcProvider } from "ethers";
import { EXPLORER_URL, RPC_URL, shortAddr } from "@/lib/litvm";

type Tx = { hash: string; from: string; to: string | null; block: number };

export default function Transactions() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const provider = new JsonRpcProvider(RPC_URL);
    const tick = async () => {
      try {
        const latest = await provider.getBlockNumber();
        const start = Math.max(latest - 8, 0);
        const blocks = await Promise.all(
          Array.from({ length: latest - start + 1 }, (_, i) => provider.getBlock(start + i, true).catch(() => null)),
        );
        const all: Tx[] = [];
        for (const b of blocks) {
          if (!b) continue;
          for (const txHash of b.transactions) {
            const tx = typeof txHash === "string" ? await provider.getTransaction(txHash).catch(() => null) : (txHash as unknown as { hash: string; from: string; to: string | null });
            if (tx) all.push({ hash: tx.hash, from: tx.from, to: (tx.to ?? null), block: b.number });
            if (all.length >= 30) break;
          }
          if (all.length >= 30) break;
        }
        if (!cancelled) { setTxs(all); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 font-display text-4xl">
          <ArrowLeftRight className="h-7 w-7 text-primary" /> Transactions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Latest transactions across recent blocks</p>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Hash</th>
              <th className="px-4 py-3">Block</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3 text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading transactions…</td></tr>}
            {!loading && txs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No recent transactions.</td></tr>}
            {txs.map((t) => (
              <tr key={t.hash} className="border-b border-border/60 hover:bg-primary/5">
                <td className="px-4 py-3 font-mono text-primary">{shortAddr(t.hash)}</td>
                <td className="px-4 py-3">#{t.block.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{shortAddr(t.from)}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.to ? shortAddr(t.to) : <span className="text-muted-foreground">contract create</span>}</td>
                <td className="px-4 py-3 text-right">
                  <a href={`${EXPLORER_URL}/tx/${t.hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
