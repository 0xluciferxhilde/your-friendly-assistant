import { Boxes, ExternalLink } from "lucide-react";
import { useLitvmNetwork } from "@/hooks/useLitvmNetwork";
import { EXPLORER_URL } from "@/lib/litvm";

export default function Blocks() {
  const { blocks, latestBlock } = useLitvmNetwork();
  const sorted = [...blocks].reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 font-display text-4xl">
          <Boxes className="h-7 w-7 text-primary" /> Blocks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest blocks on LitVM LiteForge {latestBlock && <>· #{latestBlock.toLocaleString()}</>}
        </p>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Block</th>
              <th className="px-4 py-3">TXs</th>
              <th className="px-4 py-3 text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Loading blocks…</td></tr>
            )}
            {sorted.map((b) => (
              <tr key={b.number} className="border-b border-border/60 hover:bg-primary/5">
                <td className="px-4 py-3 font-display text-primary">#{b.number.toLocaleString()}</td>
                <td className="px-4 py-3">{b.txs}</td>
                <td className="px-4 py-3 text-right">
                  <a href={`${EXPLORER_URL}/block/${b.number}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
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
