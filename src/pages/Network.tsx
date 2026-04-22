import { Network as NetIcon } from "lucide-react";
import { RPC_URL, EXPLORER_URL, LITVM_CHAIN_ID } from "@/lib/litvm";
import { useLitvmNetwork } from "@/hooks/useLitvmNetwork";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{k}</div>
      <div className="text-sm font-mono text-primary">{v}</div>
    </div>
  );
}

export default function Network() {
  const { latestBlock, avgBlockTime, gasPriceGwei } = useLitvmNetwork();
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-3 font-display text-4xl">
        <NetIcon className="h-7 w-7 text-primary" /> Network
      </h1>
      <div className="panel p-5">
        <Row k="Chain Name" v="LitVM LiteForge" />
        <Row k="Chain ID" v={LITVM_CHAIN_ID} />
        <Row k="RPC Endpoint" v={<span className="break-all">{RPC_URL}</span>} />
        <Row k="Block Explorer" v={<a className="hover:underline" href={EXPLORER_URL} target="_blank" rel="noreferrer">{EXPLORER_URL}</a>} />
        <Row k="Native Token" v="zkLTC (18 decimals)" />
        <Row k="Latest Block" v={latestBlock ? `#${latestBlock.toLocaleString()}` : "—"} />
        <Row k="Avg Block Time" v={avgBlockTime ? `${avgBlockTime.toFixed(2)} s` : "—"} />
        <Row k="Gas Price" v={gasPriceGwei != null ? `${gasPriceGwei.toFixed(3)} Gwei` : "—"} />
      </div>
    </div>
  );
}
