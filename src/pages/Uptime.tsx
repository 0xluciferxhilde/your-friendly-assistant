import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { RPC_URL } from "@/lib/litvm";

type Sample = { ts: number; ok: boolean; ms: number };

export default function Uptime() {
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const t0 = performance.now();
      let ok = false;
      try {
        const r = await fetch(RPC_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
        });
        ok = r.ok;
      } catch { ok = false; }
      const ms = performance.now() - t0;
      if (cancelled) return;
      setSamples((prev) => [...prev.slice(-29), { ts: Date.now(), ok, ms }]);
    };
    ping();
    const id = setInterval(ping, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const okCount = samples.filter((s) => s.ok).length;
  const pct = samples.length ? (okCount / samples.length) * 100 : 100;
  const avgMs = samples.length ? samples.reduce((s, x) => s + x.ms, 0) / samples.length : 0;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-3 font-display text-4xl">
        <Activity className="h-7 w-7 text-primary" /> Uptime
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">RPC Availability</div>
          <div className="mt-3 font-display text-4xl text-green">{pct.toFixed(1)}%</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Avg Latency</div>
          <div className="mt-3 font-display text-4xl text-primary">{avgMs.toFixed(0)} ms</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Samples</div>
          <div className="mt-3 font-display text-4xl text-fire">{samples.length}/30</div>
        </div>
      </div>

      <div className="panel p-4">
        <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status (last {samples.length || 30})</div>
        <div className="flex items-end gap-1">
          {Array.from({ length: 30 }).map((_, i) => {
            const s = samples[i];
            const bg = !s ? "bg-dim" : s.ok ? "bg-green" : "bg-destructive";
            return <div key={i} className={`h-10 flex-1 rounded-sm ${bg}`} title={s ? `${s.ok ? "OK" : "FAIL"} · ${s.ms.toFixed(0)}ms` : "pending"} />;
          })}
        </div>
      </div>
    </div>
  );
}
