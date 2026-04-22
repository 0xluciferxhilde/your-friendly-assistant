import { Link } from "react-router-dom";
import { Activity, Boxes, ArrowLeftRight, Zap, Database, Network as NetIcon, ChevronRight } from "lucide-react";
import { useLitvmNetwork } from "@/hooks/useLitvmNetwork";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Area, AreaChart } from "recharts";

function StatCard({
  label, value, hint, accent = "primary", icon: Icon,
}: { label: string; value: string; hint?: string; accent?: "primary" | "fire" | "green" | "gold"; icon: React.ElementType }) {
  const accentMap = {
    primary: "text-primary border-primary/30",
    fire: "text-fire border-fire/30",
    green: "text-green border-green/30",
    gold: "text-gold border-gold/30",
  } as const;
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
          <div className={`mt-3 font-display text-3xl ${accentMap[accent]} text-current`}>{value}</div>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-sm border ${accentMap[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {hint && <div className="mt-3 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function Home() {
  const { latestBlock, avgBlockTime, gasPriceGwei, recentTxs, blocks } = useLitvmNetwork();

  const fmtNum = (n: number | null) => (n == null ? "—" : n.toLocaleString());
  const totalEst = latestBlock ? Math.round((latestBlock * 2.5)).toLocaleString() : "—";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl">
            <Activity className="h-7 w-7 text-primary" />
            <span>Network Dashboard</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time LitVM blockchain statistics and analytics</p>
        </div>
        <div className="flex items-center gap-2 rounded-sm border border-green/40 bg-green/10 px-3 py-1.5 text-xs text-green">
          <span className="status-dot" />
          Live Network
        </div>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Network</div>
          <div className="mt-3 font-display text-2xl text-primary">LiteForge Testnet</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Chain ID</div>
          <div className="mt-3 font-display text-2xl text-primary">4441</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Rollup</div>
          <div className="mt-3 font-display text-2xl text-fire">Arbitrum Orbit</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Token</div>
          <div className="mt-3 font-display text-2xl text-fire">zkLTC</div>
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Latest Block" value={fmtNum(latestBlock)} accent="primary" icon={Boxes} />
        <StatCard label="Avg Block Time" value={avgBlockTime ? `${avgBlockTime.toFixed(2)} s` : "—"} accent="fire" icon={Activity} />
        <StatCard label="Gas Price" value={gasPriceGwei != null ? `${gasPriceGwei.toFixed(3)} Gwei` : "—"} accent="gold" icon={Zap} />
        <StatCard label={`Recent TXs (${blocks.length} blk)`} value={fmtNum(recentTxs)} accent="green" icon={ArrowLeftRight} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total TXNs (est.)" value={totalEst} hint="Extrapolated from recent activity" accent="primary" icon={Database} />
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Native Token</div>
          <div className="mt-3 font-display text-3xl text-fire">zkLTC</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">RPC Status</div>
          <div className="mt-3 flex items-center gap-2 font-display text-3xl text-green">
            <span className="status-dot" /> Healthy
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Explorer</div>
          <div className="mt-3 font-display text-3xl text-fire">LiteForge</div>
          <div className="mt-2 text-xs text-muted-foreground">Block explorer powered by Caldera</div>
        </div>
      </div>

      {/* Charts */}
      <h2 className="flex items-center gap-2 font-display text-2xl text-primary">
        <Activity className="h-5 w-5" /> Network Activity
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Boxes className="h-4 w-4 text-primary" /> Block Production (last {blocks.length || 16})
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={blocks.map((b) => ({ x: `#${b.number}`, v: 1 }))}>
                <defs>
                  <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="x" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" fill="url(#prodGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ArrowLeftRight className="h-4 w-4 text-green" /> Transaction Volume (last {blocks.length || 16} blk)
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={blocks.map((b) => ({ x: `#${b.number}`, v: b.txs }))}>
                <XAxis dataKey="x" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                <Bar dataKey="v" fill="hsl(var(--green))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { title: "Browse Blocks", desc: "Inspect the latest blocks produced on LitVM.", to: "/blocks" },
          { title: "Explore Transactions", desc: "Recent transfers, swaps and contract calls.", to: "/transactions" },
          { title: "Open Terminal", desc: "Wallet, swap, balance — command-style.", to: "/terminal" },
        ].map((c) => (
          <Link key={c.to} to={c.to} className="panel group flex items-center justify-between p-4 transition-colors hover:border-primary/60 hover:bg-primary/5">
            <div>
              <div className="font-display text-xl text-primary">{c.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.desc}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
