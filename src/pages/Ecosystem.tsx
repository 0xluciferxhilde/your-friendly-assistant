import { ExternalLink, Compass } from "lucide-react";
import { DAPPS } from "@/lib/litvm";

export default function Ecosystem() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 font-display text-4xl">
          <Compass className="h-7 w-7 text-primary" /> LitVM Ecosystem
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">All projects building on the LiteForge testnet.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DAPPS.map((d) => (
          <a
            key={d.name}
            href={d.url}
            target="_blank"
            rel="noreferrer"
            className="panel group relative flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-glow-cyan"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-surface text-2xl">
                {d.icon}
              </div>
              <span className="rounded-sm border border-primary/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                {d.category}
              </span>
            </div>
            <div>
              <div className="font-display text-xl">{d.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{d.desc}</div>
            </div>
            <div className="mt-auto inline-flex items-center gap-1 text-xs text-primary">
              Open <ExternalLink className="h-3 w-3" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
