import { Shield } from "lucide-react";

function Cell({ label, value, accent = "primary" }: { label: string; value: string; accent?: "primary" | "fire" }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-xl ${accent === "fire" ? "text-fire" : "text-primary"}`}>{value}</div>
    </div>
  );
}

export default function Parameters() {
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-3 font-display text-4xl">
        <Shield className="h-7 w-7 text-primary" /> Chain Parameters
      </h1>

      <div className="panel p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Cell label="Rollup Stack" value="Arbitrum Orbit" accent="fire" />
          <Cell label="Settlement" value="Ethereum" />
          <Cell label="DA Layer" value="Caldera" accent="fire" />
          <Cell label="Native Token" value="zkLTC" />
          <Cell label="Decimals" value="18" />
          <Cell label="Chain ID" value="4441" />
        </div>
      </div>
    </div>
  );
}
