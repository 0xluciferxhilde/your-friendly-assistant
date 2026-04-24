import { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits } from "ethers";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Flame,
  Pause,
  Play,
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
  Wallet,
  Users,
  Plus,
  Coins,
} from "lucide-react";
import {
  TOKEN_FACTORY_ABI,
  TOKEN_FACTORY_ADDRESS,
  TOKEN_FACTORY_CHAIN_ID,
  TOKEN_FACTORY_RPC,
  CUSTOM_TOKEN_ABI,
  type TokenInfo,
} from "@/lib/tokenFactory";
import { errMsg, shortAddr, EXPLORER_URL } from "@/lib/litvm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

type Status =
  | { kind: "idle" }
  | { kind: "info"; msg: string }
  | { kind: "ok"; msg: string; tx?: string; tokenAddr?: string }
  | { kind: "error"; msg: string };

type FormState = {
  name: string;
  symbol: string;
  decimals: string;
  totalSupply: string;
  mintable: boolean;
  burnable: boolean;
  pausable: boolean;
};

const DEFAULT_FORM: FormState = {
  name: "",
  symbol: "",
  decimals: "18",
  totalSupply: "1000000",
  mintable: true,
  burnable: true,
  pausable: false,
};

function getEthereum(): { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null {
  return (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum ?? null;
}

function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast({ title: label, description: text });
}

/** Step indicator pill */
function StepDot({ n, label, state }: { n: number; label: string; state: "done" | "active" | "todo" }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
          state === "done"
            ? "bg-blue-500/30 border border-blue-500/60 text-blue-400 shadow-[0_0_12px_-2px_rgba(59,130,246,0.5)]"
            : state === "active"
            ? "bg-blue-600/30 border border-blue-500/60 text-blue-400 shadow-[0_0_12px_-2px_rgba(59,130,246,0.5)]"
            : "border border-white/10 bg-white/5 text-white/30"
        }`}
      >
        {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <span
        className={`text-sm font-medium transition-colors ${
          state === "active" ? "text-white" : state === "done" ? "text-blue-400" : "text-white/30"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

/** Live preview card on the right */
function LivePreview({ form }: { form: FormState }) {
  const initial = (form.symbol || form.name || "?").charAt(0).toUpperCase();
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117] p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" /> Live preview
      </div>

      <div className="mt-6 flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-3xl font-bold text-white shadow-[0_0_24px_-4px_rgba(45,212,191,0.6)]">
          {initial}
        </div>
        <div className="mt-3 font-display text-2xl text-white">{form.name || "Token Name"}</div>
        <div className="text-sm font-medium text-teal-400">{form.symbol || "SYMBOL"}</div>
      </div>

      <div className="mt-6 space-y-3 border-t border-white/[0.07] pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-white/40">Total Supply</span>
          <span className="font-mono text-white">
            {form.totalSupply ? Number(form.totalSupply).toLocaleString() : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/40">Decimals</span>
          <span className="font-mono text-white">{form.decimals}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/40">Standard</span>
          <span className="font-mono text-white">ERC-20</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {[
          { k: "mintable", l: "Mintable" },
          { k: "burnable", l: "Burnable" },
          { k: "pausable", l: "Pausable" },
        ].map((f) => {
          const on = form[f.k as keyof FormState] as boolean;
          return (
            <span
              key={f.k}
              className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                on
                  ? "border border-blue-500/40 bg-blue-500/10 text-blue-400"
                  : "border border-white/10 bg-white/5 text-white/30"
              }`}
            >
              {f.l}
            </span>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-white/40">Deploying to</span>
        <span className="font-medium text-blue-400">LitVM Testnet</span>
      </div>
    </div>
  );
}

/** Submit / success modal */
function SubmitModal({
  open,
  onClose,
  status,
}: {
  open: boolean;
  onClose: () => void;
  status: Status;
}) {
  if (!open) return null;
  const ok = status.kind === "ok";
  const err = status.kind === "error";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.07] bg-[#0d1117] p-6 text-center animate-scale-in">
        <button onClick={onClose} className="absolute right-3 top-3 text-white/30 hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <div className="flex justify-center">
          {ok ? (
            <CheckCircle2 className="h-12 w-12 text-blue-400" />
          ) : err ? (
            <AlertTriangle className="h-12 w-12 text-red-400" />
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
          )}
        </div>
        <h3 className="mt-4 font-display text-2xl text-white">
          {ok ? "Success" : err ? "Failed" : "Submitting…"}
        </h3>
        <p className="mt-2 text-sm text-white/40">
          {status.kind === "info" || status.kind === "idle"
            ? "Confirm the transaction in your wallet…"
            : status.kind === "ok"
            ? status.msg
            : status.kind === "error"
            ? status.msg
            : ""}
        </p>
        {ok && status.tx && (
          <a
            href={`${EXPLORER_URL}/tx/${status.tx}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:underline"
          >
            View transaction <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-xl border border-blue-500/60 bg-blue-600/20 text-sm font-semibold text-blue-400 tracking-wide transition-colors hover:bg-blue-600/30"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export default function Deploy() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showModal, setShowModal] = useState(false);
  const [deployFee, setDeployFee] = useState<string>("0.05");
  const [totalDeployed, setTotalDeployed] = useState<number | null>(null);
  const [myTokens, setMyTokens] = useState<TokenInfo[]>([]);
  const [allTokens, setAllTokens] = useState<TokenInfo[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const onLitVM = chainId === TOKEN_FACTORY_CHAIN_ID;

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const provider = new JsonRpcProvider(TOKEN_FACTORY_RPC);
        const factory = new Contract(TOKEN_FACTORY_ADDRESS, TOKEN_FACTORY_ABI, provider);

        const [fee, total] = await Promise.all([
          factory.deployFee() as Promise<bigint>,
          factory.getTotalDeployed() as Promise<bigint>,
        ]);
        if (cancelled) return;
        setDeployFee(formatUnits(fee, 18));
        setTotalDeployed(Number(total));

        const all = (await factory.getAllTokens()) as string[];
        const recent = all.slice(-20).reverse();
        const infos = await Promise.all(
          recent.map(async (addr) => {
            try { return (await factory.getTokenInfo(addr)) as TokenInfo; }
            catch { return null; }
          })
        );
        if (cancelled) return;
        const allInfos = infos.filter((i): i is TokenInfo => i !== null);
        setAllTokens(allInfos);

        if (address) {
          let mineAddrs: string[] = [];
          try {
            mineAddrs = (await factory.getTokensByCreator(address)) as string[];
          } catch { /* ignore */ }

          let myInfos: TokenInfo[];
          if (mineAddrs.length > 0) {
            myInfos = (
              await Promise.all(
                mineAddrs.map(async (addr) => {
                  try { return (await factory.getTokenInfo(addr)) as TokenInfo; }
                  catch { return null; }
                })
              )
            ).filter((i): i is TokenInfo => i !== null);
          } else {
            const fullInfos = await Promise.all(
              all.map(async (addr) => {
                try { return (await factory.getTokenInfo(addr)) as TokenInfo; }
                catch { return null; }
              })
            );
            const lower = address.toLowerCase();
            myInfos = fullInfos
              .filter((i): i is TokenInfo => i !== null)
              .filter((i) => i.creator?.toLowerCase() === lower);
          }
          if (cancelled) return;
          setMyTokens(myInfos.reverse());
        } else {
          setMyTokens([]);
        }
      } catch (e) {
        console.error("Factory load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [address, refreshKey]);

  const supplyPreview = useMemo(() => {
    if (!/^\d+$/.test(form.totalSupply)) return null;
    try { return BigInt(form.totalSupply).toLocaleString("en-US"); } catch { return null; }
  }, [form.totalSupply]);

  const step1Valid = form.name.trim() && form.symbol.trim() && /^\d+$/.test(form.totalSupply) && BigInt(form.totalSupply || "0") > 0n;

  async function onDeploy() {
    if (!isConnected) {
      setStatus({ kind: "error", msg: "Connect wallet first" });
      setShowModal(true);
      return;
    }
    const eth = getEthereum();
    if (!eth) {
      setStatus({ kind: "error", msg: "No wallet detected" });
      setShowModal(true);
      return;
    }

    setBusy(true);
    setShowModal(true);
    setStatus({ kind: "info", msg: "Switching to LitVM…" });
    try {
      if (!onLitVM) {
        await switchChain({ chainId: TOKEN_FACTORY_CHAIN_ID });
      }

      setStatus({ kind: "info", msg: "Preparing transaction…" });
      const provider = new BrowserProvider(eth as unknown as ConstructorParameters<typeof BrowserProvider>[0]);
      const signer = await provider.getSigner();
      const factory = new Contract(TOKEN_FACTORY_ADDRESS, TOKEN_FACTORY_ABI, signer);

      const fee = (await factory.deployFee()) as bigint;

      setStatus({ kind: "info", msg: `Deploying ${form.symbol}… confirm in wallet (${formatUnits(fee, 18)} zkLTC fee)` });
      const tx = await factory.deployToken(
        form.name.trim(),
        form.symbol.trim(),
        parseInt(form.decimals, 10),
        BigInt(form.totalSupply),
        form.mintable,
        form.burnable,
        form.pausable,
        { value: fee }
      );
      setStatus({ kind: "info", msg: `Tx submitted: ${tx.hash.slice(0, 10)}… waiting for confirmation` });

      const receipt = await tx.wait();

      let tokenAddr: string | undefined;
      try {
        for (const log of receipt?.logs ?? []) {
          try {
            const parsed = factory.interface.parseLog(log);
            if (parsed?.name === "TokenDeployed") {
              tokenAddr = parsed.args[0] as string;
              break;
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }

      setStatus({
        kind: "ok",
        msg: `${form.symbol} deployed successfully!`,
        tx: tx.hash,
        tokenAddr,
      });
      toast({ title: "Token deployed!", description: `${form.symbol} live on LitVM` });
      setForm(DEFAULT_FORM);
      setStep(1);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setStatus({ kind: "error", msg: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function tokenAction(tokenAddr: string, action: "pause" | "unpause" | "burn" | "mint", arg?: string) {
    const eth = getEthereum();
    if (!eth) return toast({ title: "No wallet", description: "Connect wallet first" });
    try {
      if (!onLitVM) await switchChain({ chainId: TOKEN_FACTORY_CHAIN_ID });
      const provider = new BrowserProvider(eth as unknown as ConstructorParameters<typeof BrowserProvider>[0]);
      const signer = await provider.getSigner();
      const token = new Contract(tokenAddr, CUSTOM_TOKEN_ABI, signer);

      let tx;
      if (action === "pause") tx = await token.pause();
      else if (action === "unpause") tx = await token.unpause();
      else if (action === "burn") {
        const decimals = (await token.decimals()) as number;
        tx = await token.burn(BigInt(arg ?? "0") * (10n ** BigInt(decimals)));
      } else if (action === "mint") {
        const decimals = (await token.decimals()) as number;
        tx = await token.mint(address, BigInt(arg ?? "0") * (10n ** BigInt(decimals)));
      }
      toast({ title: "Tx submitted", description: tx.hash.slice(0, 18) + "…" });
      await tx.wait();
      toast({ title: `${action} confirmed`, description: shortAddr(tokenAddr) });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast({ title: "Failed", description: errMsg(e) });
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-primary">
            <Rocket className="h-3 w-3" /> Token Launchpad
          </div>
          <h1 className="mt-3 font-display text-5xl">
            <span className="text-gradient-aurora">Deploy ERC-20</span>
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Launch your token in seconds · {deployFee} zkLTC fee · LitVM testnet
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-white/30">Total Deployed</div>
            <div className="mt-0.5 font-display text-2xl text-white">{totalDeployed ?? "—"}</div>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-white/30">Factory</div>
            <button
              onClick={() => copyText(TOKEN_FACTORY_ADDRESS, "Factory address copied")}
              className="mt-0.5 flex items-center gap-1 font-mono text-sm text-white/70 hover:text-white"
            >
              {shortAddr(TOKEN_FACTORY_ADDRESS)}
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Network warning */}
      {isConnected && !onLitVM && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
          <div className="flex-1">
            <div className="font-medium text-white">Wrong network</div>
            <div className="text-xs text-white/40">TokenFactory lives on LitVM LiteForge (Chain 4441).</div>
          </div>
          <button
            onClick={() => switchChain({ chainId: TOKEN_FACTORY_CHAIN_ID })}
            className="rounded-lg border border-orange-500/60 bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-400 hover:bg-orange-500/30"
          >
            Switch network
          </button>
        </div>
      )}

      <Tabs defaultValue="deploy" className="space-y-6">
        <TabsList className="bg-white/[0.03] border border-white/[0.07] backdrop-blur">
          <TabsTrigger value="deploy" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Deploy
          </TabsTrigger>
          <TabsTrigger value="mine" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400">
            <Wallet className="mr-1.5 h-3.5 w-3.5" /> My Tokens ({myTokens.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400">
            <Users className="mr-1.5 h-3.5 w-3.5" /> All Tokens
          </TabsTrigger>
        </TabsList>

        {/* DEPLOY tab — wizard */}
        <TabsContent value="deploy">
          {/* Stepper */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <StepDot n={1} label="Token Basics" state={step === 1 ? "active" : "done"} />
            <div className="h-px w-10 bg-white/10" />
            <StepDot n={2} label="Features" state={step === 2 ? "active" : step > 2 ? "done" : "todo"} />
            <div className="h-px w-10 bg-white/10" />
            <StepDot n={3} label="Review & Deploy" state={step === 3 ? "active" : "todo"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Left: form */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117] p-6">
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-2xl text-white">Token Basics</h2>
                    <p className="text-sm text-white/40">Define the core parameters of your token.</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Token Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      placeholder="My Awesome Token"
                      maxLength={50}
                      className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 text-sm text-white placeholder:text-white/20 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="mt-1 text-[11px] text-white/30">Max 50 characters — appears in wallets</div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Token Symbol <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={form.symbol}
                      onChange={(e) => update("symbol", e.target.value.toUpperCase())}
                      placeholder="MAT"
                      maxLength={11}
                      className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 font-mono text-sm uppercase text-white placeholder:text-white/20 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="mt-1 text-[11px] text-white/30">e.g. MAT — appears on DEXes</div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Total Supply <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={form.totalSupply}
                      onChange={(e) => update("totalSupply", e.target.value.replace(/\D/g, ""))}
                      placeholder="1000000"
                      className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 font-mono text-sm text-white placeholder:text-white/20 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="mt-1 text-[11px] text-white/30">
                      {supplyPreview ? `${supplyPreview} ${form.symbol || "tokens"}` : "Whole units (no decimals applied)"}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">Decimals</label>
                    <input
                      value={form.decimals}
                      onChange={(e) => update("decimals", e.target.value.replace(/\D/g, ""))}
                      placeholder="18 (Standard)"
                      className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 font-mono text-sm text-white placeholder:text-white/20 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="mt-1 text-[11px] text-white/30">18 decimals is standard for most tokens</div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setStep(2)}
                      disabled={!step1Valid}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-500/60 bg-blue-600/20 px-5 py-2.5 text-sm font-semibold text-blue-400 tracking-wide transition-colors hover:bg-blue-600/30 disabled:opacity-40"
                    >
                      Next <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-2xl text-white">Token Features</h2>
                    <p className="text-sm text-white/40">Configure optional capabilities for your token.</p>
                  </div>

                  {[
                    { key: "mintable" as const, label: "Mintable", desc: "Owner can create additional tokens after launch" },
                    { key: "burnable" as const, label: "Burnable", desc: "Token holders can permanently destroy their tokens" },
                    { key: "pausable" as const, label: "Pausable", desc: "Owner can pause all token transfers in an emergency" },
                  ].map((f) => (
                    <label
                      key={f.key}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                        form[f.key]
                          ? "border-blue-500/40 bg-blue-500/10"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-blue-500/20"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{f.label}</div>
                        <div className="mt-0.5 text-xs text-white/40">{f.desc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => update(f.key, !form[f.key])}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          form[f.key] ? "bg-blue-600" : "bg-white/10 border border-white/10"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            form[f.key] ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </label>
                  ))}

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 hover:border-white/20 hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-500/60 bg-blue-600/20 px-5 py-2.5 text-sm font-semibold text-blue-400 tracking-wide transition-colors hover:bg-blue-600/30"
                    >
                      Next <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-2xl text-white">Review & Deploy</h2>
                    <p className="text-sm text-white/40">Confirm your token configuration before deploying.</p>
                  </div>

                  <div className="space-y-0 rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden text-sm">
                    {[
                      ["Token Name", form.name || "—"],
                      ["Symbol", form.symbol || "—"],
                      ["Total Supply", supplyPreview ?? "—"],
                      ["Decimals", form.decimals || "18"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3 last:border-0">
                        <span className="text-white/40">{k}</span>
                        <span className="font-mono text-white">{v}</span>
                      </div>
                    ))}
                    <div className="flex items-start justify-between px-4 py-3">
                      <span className="text-white/40">Features</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { k: "mintable", l: "Mintable" },
                          { k: "burnable", l: "Burnable" },
                          { k: "pausable", l: "Pausable" },
                        ].map((f) => {
                          const on = form[f.k as keyof FormState] as boolean;
                          return (
                            <span
                              key={f.k}
                              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                                on
                                  ? "border border-blue-500/40 bg-blue-500/10 text-blue-400"
                                  : "border border-white/10 bg-white/5 text-white/30"
                              }`}
                            >
                              {f.l}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Fee section */}
                  <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-600/10 p-4">
                    <div>
                      <div className="text-xs text-white/40">Deployment Fee</div>
                      <div className="font-display text-xl text-blue-400">{deployFee} zkLTC</div>
                    </div>
                    <Coins className="h-6 w-6 text-blue-400/60" />
                  </div>

                  {/* Deploy button */}
                  <button
                    onClick={onDeploy}
                    disabled={busy}
                    className="h-14 w-full rounded-xl border border-blue-500/60 bg-blue-600/20 text-base font-semibold text-blue-400 tracking-wide transition-colors hover:bg-blue-600/30 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                    Deploy Token
                  </button>

                  <div className="text-center text-[11px] text-white/30">
                    A non-refundable deployment fee of {deployFee} zkLTC will be charged on confirmation.
                  </div>

                  <div className="flex justify-start pt-2">
                    <button
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 hover:border-white/20 hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: live preview */}
            <LivePreview form={form} />
          </div>
        </TabsContent>

        {/* MY TOKENS tab */}
        <TabsContent value="mine">
          {myTokens.length === 0 ? (
            <EmptyState text={isConnected ? "You haven't deployed any tokens yet." : "Connect wallet to see your tokens."} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {myTokens.map((t) => <TokenCard key={t.contractAddress} token={t} owned onAction={tokenAction} />)}
            </div>
          )}
        </TabsContent>

        {/* ALL TOKENS tab */}
        <TabsContent value="all">
          {allTokens.length === 0 ? (
            <EmptyState text="No tokens deployed yet via this factory." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {allTokens.map((t) => <TokenCard key={t.contractAddress} token={t} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SubmitModal open={showModal} onClose={() => setShowModal(false)} status={status} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117] p-12 text-center text-sm text-white/30">{text}</div>
  );
}

function TokenCard({
  token, owned, onAction,
}: { token: TokenInfo; owned?: boolean; onAction?: (addr: string, action: "pause" | "unpause" | "burn" | "mint", arg?: string) => void }) {
  const initial = (token.symbol || "?").charAt(0).toUpperCase();
  const supply = formatUnits(token.totalSupply, token.decimals);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117] p-4 transition-all hover:border-blue-500/30">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-lg font-bold text-white shadow-[0_0_16px_-4px_rgba(45,212,191,0.5)]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-display text-lg text-white">{token.name}</div>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">
              {token.symbol}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-white/30">
            {shortAddr(token.contractAddress)}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => copyText(token.contractAddress, "Address copied")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/30 hover:border-white/20 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <a
            href={`${EXPLORER_URL}/address/${token.contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/30 hover:border-white/20 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
          <div className="text-[10px] uppercase tracking-wider text-white/30">Supply</div>
          <div className="font-mono text-white">{Number(supply).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
          <div className="text-[10px] uppercase tracking-wider text-white/30">Decimals</div>
          <div className="font-mono text-white">{token.decimals}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {token.mintable && <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-blue-400">Mintable</span>}
        {token.burnable && <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-orange-400">Burnable</span>}
        {token.pausable && <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-yellow-400">Pausable</span>}
      </div>

      {owned && onAction && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.05] pt-3">
          {token.mintable && (
            <button
              onClick={() => {
                const a = prompt("Mint how many tokens?");
                if (a && /^\d+$/.test(a)) onAction(token.contractAddress, "mint", a);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/5 px-2.5 py-1 text-[11px] text-blue-400 hover:bg-blue-500/10"
            >
              <Plus className="h-3 w-3" /> Mint
            </button>
          )}
          {token.burnable && (
            <button
              onClick={() => {
                const a = prompt("Burn how many tokens?");
                if (a && /^\d+$/.test(a)) onAction(token.contractAddress, "burn", a);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-orange-500/40 bg-orange-500/5 px-2.5 py-1 text-[11px] text-orange-400 hover:bg-orange-500/10"
            >
              <Flame className="h-3 w-3" /> Burn
            </button>
          )}
          {token.pausable && (
            <>
              <button
                onClick={() => onAction(token.contractAddress, "pause")}
                className="inline-flex items-center gap-1 rounded-lg border border-yellow-500/40 bg-yellow-500/5 px-2.5 py-1 text-[11px] text-yellow-400 hover:bg-yellow-500/10"
              >
                <Pause className="h-3 w-3" /> Pause
              </button>
              <button
                onClick={() => onAction(token.contractAddress, "unpause")}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/5 px-2.5 py-1 text-[11px] text-blue-400 hover:bg-blue-500/10"
              >
                <Play className="h-3 w-3" /> Unpause
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}