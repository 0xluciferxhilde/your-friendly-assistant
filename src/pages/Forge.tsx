import { useEffect, useMemo, useState } from "react";
import {
  Hammer,
  Copy,
  Download,
  Check,
  ExternalLink,
  Rocket,
  Zap,
  ShieldCheck,
  Coins,
  Image as ImageIcon,
  Lock,
  Hourglass,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Wallet,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther, parseEther, parseUnits, isAddress, decodeEventLog, type Hex } from "viem";
import { EXPLORER_URL, LITVM_CHAIN_ID, shortAddr } from "@/lib/litvm";
import {
  LITVM_FACTORY_ABI,
  LITVM_FACTORY_ADDRESS,
  LITVM_FACTORY_DEFAULT_FEE_ETHER,
  LITVM_FACTORY_NATIVE_SYMBOL,
  FACTORY_TYPE_LABEL,
} from "@/lib/litvmFactory";
import {
  Erc20Form,
  ForgeKind,
  NftForm,
  StakingForm,
  VestingForm,
  genErc20,
  genNft,
  genStaking,
  genVesting,
  genFactory,
  getContractName,
  type FactoryForm,
} from "@/lib/forgeTemplates";
import { TiltCard } from "@/components/TiltCard";
import { TxResultModal, type TxResultKind, type TxResultDetail } from "@/components/TxResultModal";
import { pushWalletTx } from "@/hooks/useWalletHistory";

type DeployStatus =
  | { kind: "idle" }
  | { kind: "deploying"; tx?: `0x${string}` }
  | { kind: "ok"; tx: `0x${string}`; address: `0x${string}` }
  | { kind: "error"; msg: string };

type SupportedKind = ForgeKind;

const TABS: { value: SupportedKind; label: string; icon: typeof Coins; desc: string }[] = [
  { value: "erc20", label: "ERC20 Token", icon: Coins, desc: "Standard fungible token with optional mint, burn, pause." },
  { value: "nft", label: "NFT (ERC721)", icon: ImageIcon, desc: "ERC721 collection with mint price, max supply, public mint toggle." },
  { value: "staking", label: "Staking", icon: Lock, desc: "Single-asset staking pool with daily reward rate and lock period." },
  { value: "vesting", label: "Vesting", icon: Hourglass, desc: "Cliff + linear vesting for team / investor / advisor allocations." },
  { value: "factory", label: "Token Factory", icon: Hammer, desc: "Deploy your own ERC20 factory with custom fee, whitelist, and token tracking." },
];

const initErc20: Erc20Form = {
  name: "", symbol: "", supply: "1000000", decimals: "18", owner: "",
  mintable: true, burnable: true, pausable: true, ownable: true,
  tax: false, reentrancyGuard: true, taxBps: "200", taxAddr: "",
};

const initNft: NftForm = {
  name: "", symbol: "", maxSupply: "10000", price: "0.05", perWallet: "5",
  baseUri: "", whitelist: false, reveal: false, royalty: false,
  royaltyBps: "500", royaltyAddr: "",
};

const initStaking: StakingForm = {
  contractName: "", stakeToken: "", rewardToken: "", apr: "12",
  lockDays: "30", minStake: "1", emergency: true, pausable: true, autoCompound: false,
};

const initVesting: VestingForm = {
  contractName: "", token: "", cliffDays: "90", durationDays: "365",
  beneficiary: "", amount: "", revocable: true, multiBeneficiary: false, emitEvents: true,
};

const initFactoryForm: FactoryForm = {
  contractName: "LitVMTokenFactory", fee: "0.05", owner: "",
  mintable: true, burnable: true, pausable: true,
  customDecimals: true, trackTokens: true, whitelist: false,
};

// ─── Shared UI primitives ────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-white/60">
      {children}{required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, maxLength, mono, hint,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  maxLength?: number; mono?: boolean; hint?: string;
}) {
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 text-sm text-white placeholder:text-white/20 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 ${mono ? "font-mono" : ""}`}
      />
      {hint && <div className="mt-1 text-[11px] text-white/30">{hint}</div>}
    </>
  );
}

function NumberInput({
  value, onChange, min, max, step, hint,
}: {
  value: string; onChange: (v: string) => void;
  min?: number; max?: number; step?: string; hint?: string;
}) {
  return (
    <>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 font-mono text-sm text-white placeholder:text-white/20 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {hint && <div className="mt-1 text-[11px] text-white/30">{hint}</div>}
    </>
  );
}

function Toggle({
  checked, onChange, label, desc,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
        checked
          ? "border-primary/40 bg-primary/10"
          : "border-white/[0.07] bg-white/[0.02] hover:border-primary/20"
      }`}
    >
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        {desc && <div className="mt-0.5 text-xs text-white/40">{desc}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-white/10 border border-white/10"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/30">
      <span className="h-px flex-1 bg-white/[0.07]" />
      {children}
      <span className="h-px flex-1 bg-white/[0.07]" />
    </div>
  );
}

// ─── Tab panels ──────────────────────────────────────────────────────────────

function Erc20Panel({ form, setForm }: { form: Erc20Form; setForm: (f: Erc20Form) => void }) {
  const set = <K extends keyof Erc20Form>(k: K, v: Erc20Form[K]) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-5">
      <FieldRow>
        <Field label="Token Name" required>
          <TextInput value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. PepeCoin" maxLength={50} hint="Max 50 characters — appears in wallets" />
        </Field>
        <Field label="Token Symbol" required>
          <TextInput value={form.symbol} onChange={(v) => set("symbol", v.toUpperCase())} placeholder="e.g. PEPE" maxLength={11} mono hint="e.g. PEPE — appears on DEXes" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Total Supply" required>
          <TextInput value={form.supply} onChange={(v) => set("supply", v.replace(/\D/g, ""))} placeholder="1000000" mono hint="Whole units — decimals applied automatically" />
        </Field>
        <Field label="Decimals">
          <NumberInput value={form.decimals} onChange={(v) => set("decimals", v)} min={0} max={18} hint="18 decimals is standard for most tokens" />
        </Field>
      </FieldRow>
      <SectionDivider>features</SectionDivider>
      <div className="space-y-2">
        <Toggle label="Mintable" desc="Owner can create additional tokens after launch" checked={form.mintable} onChange={(v) => set("mintable", v)} />
        <Toggle label="Burnable" desc="Token holders can permanently destroy their tokens" checked={form.burnable} onChange={(v) => set("burnable", v)} />
        <Toggle label="Pausable" desc="Owner can pause all token transfers in an emergency" checked={form.pausable} onChange={(v) => set("pausable", v)} />
      </div>
    </div>
  );
}

function NftPanel({ form, setForm }: { form: NftForm; setForm: (f: NftForm) => void }) {
  const set = <K extends keyof NftForm>(k: K, v: NftForm[K]) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-5">
      <FieldRow>
        <Field label="Collection Name" required>
          <TextInput value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. LitVM Punks" />
        </Field>
        <Field label="Symbol" required>
          <TextInput value={form.symbol} onChange={(v) => set("symbol", v.toUpperCase())} placeholder="e.g. LVMP" mono />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Max Supply" required>
          <NumberInput value={form.maxSupply} onChange={(v) => set("maxSupply", v)} hint="Maximum NFTs that can ever exist" />
        </Field>
        <Field label={`Mint Price (${LITVM_FACTORY_NATIVE_SYMBOL})`}>
          <NumberInput value={form.price} onChange={(v) => set("price", v)} step="0.001" hint="Price per NFT mint" />
        </Field>
      </FieldRow>
      <Field label="Base URI" required>
        <TextInput
          value={form.baseUri}
          onChange={(v) => set("baseUri", v)}
          placeholder="https://api.yourproject.xyz/meta/"
          hint="Metadata folder — token URIs become {baseURI}{tokenId}.json"
        />
      </Field>
    </div>
  );
}

function StakingPanel({ form, setForm }: { form: StakingForm; setForm: (f: StakingForm) => void }) {
  const set = <K extends keyof StakingForm>(k: K, v: StakingForm[K]) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-5">
      <FieldRow>
        <Field label="Staking Token Address" required>
          <TextInput value={form.stakeToken} onChange={(v) => set("stakeToken", v)} placeholder="0x… ERC20 to stake" mono />
        </Field>
        <Field label="Reward Token Address">
          <TextInput value={form.rewardToken} onChange={(v) => set("rewardToken", v)} placeholder="0x… (blank = same as stake)" mono hint="Leave blank to use same token as reward" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Annual Reward Rate (%)">
          <NumberInput value={form.apr} onChange={(v) => set("apr", v)} hint="Converted to per-day rate × 1e18 on-chain" />
        </Field>
        <Field label="Lock Period (days)">
          <NumberInput value={form.lockDays} onChange={(v) => set("lockDays", v)} hint="Minimum staking duration" />
        </Field>
      </FieldRow>
      <Field label="Pool Label">
        <TextInput value={form.contractName} onChange={(v) => set("contractName", v)} placeholder="e.g. PEPE Staking Pool" hint="Stored on-chain as the contract's display name" />
      </Field>
    </div>
  );
}

function VestingPanel({ form, setForm }: { form: VestingForm; setForm: (f: VestingForm) => void }) {
  const set = <K extends keyof VestingForm>(k: K, v: VestingForm[K]) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-5">
      <FieldRow>
        <Field label="Token Address" required>
          <TextInput value={form.token} onChange={(v) => set("token", v)} placeholder="0x… token to vest" mono />
        </Field>
        <Field label="Vesting Label">
          <TextInput value={form.contractName} onChange={(v) => set("contractName", v)} placeholder="e.g. Team Vesting" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Beneficiary Address" required>
          <TextInput value={form.beneficiary} onChange={(v) => set("beneficiary", v)} placeholder="0x…" mono />
        </Field>
        <Field label="Total Amount (wei)" required>
          <TextInput value={form.amount} onChange={(v) => set("amount", v)} placeholder="e.g. 10000000000000000000000" mono hint="Raw amount including decimals" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Cliff Period (days)">
          <NumberInput value={form.cliffDays} onChange={(v) => set("cliffDays", v)} hint="No tokens released before cliff ends" />
        </Field>
        <Field label="Vesting Duration (days after cliff)">
          <NumberInput value={form.durationDays} onChange={(v) => set("durationDays", v)} />
        </Field>
      </FieldRow>
      <SectionDivider>features</SectionDivider>
      <Toggle label="Revocable by owner" desc="Owner can cancel and reclaim unvested tokens" checked={form.revocable} onChange={(v) => set("revocable", v)} />
    </div>
  );
}

// ─── NEW: Factory Panel ───────────────────────────────────────────────────────

function FactoryPanel({ form, setForm }: { form: FactoryForm; setForm: (f: FactoryForm) => void }) {
  const set = <K extends keyof FactoryForm>(k: K, v: FactoryForm[K]) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-5">
      <FieldRow>
        <Field label="Factory Contract Name" required>
          <TextInput
            value={form.contractName}
            onChange={(v) => set("contractName", v)}
            placeholder="e.g. LitVMTokenFactory"
            maxLength={50}
            hint="Name of the factory contract itself"
          />
        </Field>
        <Field label="Owner Address">
          <TextInput
            value={form.owner}
            onChange={(v) => set("owner", v)}
            placeholder="0x… (blank = deployer)"
            mono
            hint="Leave blank to use deployer address"
          />
        </Field>
      </FieldRow>
      <Field label={`Deploy Fee (${LITVM_FACTORY_NATIVE_SYMBOL})`}>
        <NumberInput
          value={form.fee}
          onChange={(v) => set("fee", v)}
          step="0.001"
          hint="Fee charged to users who deploy tokens via your factory"
        />
      </Field>
      <SectionDivider>default token features</SectionDivider>
      <div className="space-y-2">
        <Toggle label="Mintable" desc="Deployed tokens will support minting by owner" checked={form.mintable} onChange={(v) => set("mintable", v)} />
        <Toggle label="Burnable" desc="Deployed tokens will support burning by holders" checked={form.burnable} onChange={(v) => set("burnable", v)} />
        <Toggle label="Pausable" desc="Deployed tokens can be paused by owner" checked={form.pausable} onChange={(v) => set("pausable", v)} />
      </div>
      <SectionDivider>factory options</SectionDivider>
      <div className="space-y-2">
        <Toggle label="Custom Decimals" desc="Allow deployers to set custom decimal places (0–18)" checked={form.customDecimals} onChange={(v) => set("customDecimals", v)} />
        <Toggle label="Track Tokens" desc="Factory keeps a registry of all deployed token addresses" checked={form.trackTokens} onChange={(v) => set("trackTokens", v)} />
        <Toggle label="Whitelist" desc="Only whitelisted addresses can deploy tokens via this factory" checked={form.whitelist} onChange={(v) => set("whitelist", v)} />
      </div>
    </div>
  );
}

// ─── Deploy Modal ─────────────────────────────────────────────────────────────

function DeployModal({
  open, status, contractName, onClose,
}: {
  open: boolean; status: DeployStatus; contractName: string; onClose: () => void;
}) {
  if (!open) return null;
  const busy = status.kind === "deploying";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.07] bg-[#0d1117] p-6 text-center">
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute right-3 top-3 text-white/30 hover:text-white disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex justify-center">
          {status.kind === "ok" ? (
            <CheckCircle2 className="h-12 w-12 text-primary" />
          ) : status.kind === "error" ? (
            <AlertCircle className="h-12 w-12 text-red-400" />
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
        </div>

        <h3 className="mt-4 font-display text-2xl text-white">
          {status.kind === "deploying" && "Deploying…"}
          {status.kind === "ok" && "Deployed!"}
          {status.kind === "error" && "Failed"}
          {status.kind === "idle" && "Deploy"}
        </h3>
        <p className="mt-1 font-mono text-[11px] text-white/30">// {contractName}</p>

        {status.kind === "deploying" && (
          <p className="mt-3 text-sm text-white/40">
            Confirm the transaction in your wallet, then waiting for confirmation…
          </p>
        )}

        {status.kind === "deploying" && status.tx && (
          <a
            href={`${EXPLORER_URL}/tx/${status.tx}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            View tx <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {status.kind === "ok" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-left">
              <div className="text-[10px] uppercase tracking-wider text-white/30">Contract Address</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all font-mono text-xs text-primary">{status.address}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(status.address)}
                  className="shrink-0 text-white/30 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`${EXPLORER_URL}/address/${status.address}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 hover:border-white/20 hover:text-white"
              >
                <ExternalLink className="h-3 w-3" /> Contract
              </a>
              <a
                href={`${EXPLORER_URL}/tx/${status.tx}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/60 bg-primary/20 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/30"
              >
                <ExternalLink className="h-3 w-3" /> Transaction
              </a>
            </div>
          </div>
        )}

        {status.kind === "error" && (
          <div className="mt-4 space-y-3">
            <pre className="max-h-40 overflow-auto rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-left font-mono text-[11px] text-red-400">
              {status.msg}
            </pre>
            <button
              onClick={onClose}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white/60 hover:border-white/20 hover:text-white"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Forge() {
  const [tab, setTab] = useState<SupportedKind>("erc20");
  const [erc20, setErc20] = useState<Erc20Form>(initErc20);
  const [nft, setNft] = useState<NftForm>(initNft);
  const [staking, setStaking] = useState<StakingForm>(initStaking);
  const [vesting, setVesting] = useState<VestingForm>(initVesting);
  const [factory, setFactory] = useState<FactoryForm>(initFactoryForm);
  const [generated, setGenerated] = useState<Record<SupportedKind, string>>({ erc20: "", nft: "", staking: "", vesting: "", factory: "" });
  const [copied, setCopied] = useState(false);
  const [deploy, setDeploy] = useState<DeployStatus>({ kind: "idle" });
  const [showDeploy, setShowDeploy] = useState(false);
  const [myContracts, setMyContracts] = useState<Array<{ address: `0x${string}`; type: number; label: string; deployedAt: number }>>([]);
  const [resultModal, setResultModal] = useState<{
    open: boolean; kind: TxResultKind; title: string; subtitle?: string; txHash?: string; details?: TxResultDetail[];
  }>({ open: false, kind: "ok", title: "" });

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: LITVM_CHAIN_ID });

  const { data: feeWei } = useReadContract({
    address: LITVM_FACTORY_ADDRESS,
    abi: LITVM_FACTORY_ABI,
    functionName: "deployFee",
    chainId: LITVM_CHAIN_ID,
  });
  const feeEther = feeWei ? formatEther(feeWei as bigint) : LITVM_FACTORY_DEFAULT_FEE_ETHER;

  const code = generated[tab];
  const forms = { erc20, nft, staking, vesting, factory };
  const contractName = getContractName(tab, forms);
  const fileName = useMemo(() => contractName + ".sol", [contractName]);

  const loadMine = async () => {
    if (!address || !publicClient) return;
    try {
      const addrs = (await publicClient.readContract({
        address: LITVM_FACTORY_ADDRESS,
        abi: LITVM_FACTORY_ABI,
        functionName: "getContractsByCreator",
        args: [address],
      })) as `0x${string}`[];

      const infos = await Promise.all(
        addrs.map((a) =>
          publicClient.readContract({
            address: LITVM_FACTORY_ADDRESS,
            abi: LITVM_FACTORY_ABI,
            functionName: "getContractInfo",
            args: [a],
          }),
        ),
      );
      setMyContracts(
        (infos as Array<{ contractAddress: `0x${string}`; contractType: number; label: string; deployedAt: bigint }>)
          .map((i) => ({ address: i.contractAddress, type: Number(i.contractType), label: i.label, deployedAt: Number(i.deployedAt) }))
          .reverse(),
      );
    } catch (e) {
      console.warn("loadMine failed", e);
    }
  };

  useEffect(() => { loadMine(); }, [address, publicClient]);

  const onGenerate = () => {
    let out = "";
    if (tab === "erc20") out = genErc20(erc20);
    else if (tab === "nft") out = genNft(nft);
    else if (tab === "staking") out = genStaking(staking);
    else if (tab === "factory") out = genFactory(factory);
    else out = genVesting(vesting);
    setGenerated((p) => ({ ...p, [tab]: out }));
    toast({ title: "Contract preview generated", description: `${fileName} ready to copy or deploy.` });
    requestAnimationFrame(() => {
      document.getElementById("forge-output")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const onDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const buildFactoryCall = (): {
    functionName: "deployERC20" | "deployNFT" | "deployStaking" | "deployVesting";
    args: readonly unknown[];
    value: bigint;
  } => {
    const value = (feeWei as bigint | undefined) ?? parseEther(LITVM_FACTORY_DEFAULT_FEE_ETHER);
    if (tab === "erc20") {
      if (!erc20.name.trim()) throw new Error("Token name is required");
      if (!erc20.symbol.trim()) throw new Error("Token symbol is required");
      const decimals = Number(erc20.decimals || "18");
      if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) throw new Error("Decimals must be 0–18");
      const supply = BigInt(erc20.supply || "0");
      if (supply <= 0n) throw new Error("Supply must be greater than 0");
      return { functionName: "deployERC20", args: [erc20.name.trim(), erc20.symbol.trim(), decimals, supply, erc20.mintable, erc20.burnable, erc20.pausable], value };
    }
    if (tab === "nft") {
      if (!nft.name.trim()) throw new Error("Collection name is required");
      if (!nft.symbol.trim()) throw new Error("Symbol is required");
      const maxSupply = BigInt(nft.maxSupply || "0");
      if (maxSupply <= 0n) throw new Error("Max supply must be greater than 0");
      const mintPriceWei = parseEther(nft.price || "0");
      return { functionName: "deployNFT", args: [nft.name.trim(), nft.symbol.trim(), nft.baseUri.trim(), maxSupply, mintPriceWei, true], value };
    }
    if (tab === "staking") {
      if (!isAddress(staking.stakeToken)) throw new Error("Invalid staking token address");
      const reward = staking.rewardToken?.trim() ? staking.rewardToken : staking.stakeToken;
      if (!isAddress(reward)) throw new Error("Invalid reward token address");
      const aprNum = Number(staking.apr || "0");
      if (!Number.isFinite(aprNum) || aprNum < 0) throw new Error("Invalid APR");
      const aprScaled = parseUnits(aprNum.toString(), 18);
      const ratePerDay = aprScaled / (100n * 365n);
      const lockDays = BigInt(staking.lockDays || "0");
      const label = (staking.contractName || `${shortAddr(staking.stakeToken)} Staking`).trim();
      return { functionName: "deployStaking", args: [staking.stakeToken, reward, ratePerDay, lockDays, label], value };
    }
    if (tab === "factory") {
      // Factory tab: source-only, no on-chain factory deploy call for this type
      throw new Error("Token Factory is a source-only template. Use 'Preview Source' to download the Solidity code and deploy manually via Remix or Hardhat.");
    }
    if (!isAddress(vesting.token)) throw new Error("Invalid token address");
    if (!isAddress(vesting.beneficiary)) throw new Error("Invalid beneficiary address");
    const amount = BigInt(vesting.amount || "0");
    if (amount <= 0n) throw new Error("Vesting amount must be greater than 0");
    const cliffDays = BigInt(vesting.cliffDays || "0");
    const durationDays = BigInt(vesting.durationDays || "0");
    if (durationDays <= 0n) throw new Error("Vesting duration must be greater than 0");
    const label = (vesting.contractName || "Vesting").trim();
    return { functionName: "deployVesting", args: [vesting.token, vesting.beneficiary, amount, cliffDays, durationDays, vesting.revocable, label], value };
  };

  const onDeploy = async () => {
    if (!isConnected || !walletClient || !address) {
      toast({ title: "Connect wallet", description: "Connect your wallet to deploy on LitVM.", variant: "destructive" });
      return;
    }
    setShowDeploy(true);
    setDeploy({ kind: "deploying" });
    try {
      if (chainId !== LITVM_CHAIN_ID) {
        try { await switchChainAsync({ chainId: LITVM_CHAIN_ID }); }
        catch { throw new Error("Please switch your wallet to LitVM (Chain 4441) and try again."); }
      }
      const { functionName, args, value } = buildFactoryCall();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callArgs: any = args;
      await publicClient!.simulateContract({ address: LITVM_FACTORY_ADDRESS, abi: LITVM_FACTORY_ABI, functionName, args: callArgs, value, account: address });
      const hash = await walletClient.writeContract({ address: LITVM_FACTORY_ADDRESS, abi: LITVM_FACTORY_ABI, functionName, args: callArgs, value, account: walletClient.account, chain: walletClient.chain });
      setDeploy({ kind: "deploying", tx: hash });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      let deployedAddr: `0x${string}` | undefined;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== LITVM_FACTORY_ADDRESS.toLowerCase()) continue;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decoded = decodeEventLog({ abi: LITVM_FACTORY_ABI, data: log.data as Hex, topics: (log as any).topics }) as any;
          if (decoded.eventName === "ContractDeployed") { deployedAddr = decoded.args.contractAddress as `0x${string}`; break; }
        } catch { /* skip */ }
      }
      if (!deployedAddr) throw new Error("Deployment confirmed but contract address not found in logs.");
      setDeploy({ kind: "ok", tx: hash, address: deployedAddr });
      setShowDeploy(false);
      setResultModal({
        open: true,
        kind: "ok",
        title: "Contract Deployed",
        subtitle: `Your ${activeTab.label} is live on LitVM.`,
        txHash: hash,
        details: [
          { label: "Type", value: activeTab.label },
          { label: "Name", value: contractName },
          { label: "Contract", value: deployedAddr, addressLink: true },
        ],
      });
      pushWalletTx({
        hash,
        kind: "deploy",
        title: `Deployed ${activeTab.label}`,
        subtitle: `${contractName} · ${shortAddr(deployedAddr)}`,
        time: Date.now(),
        account: address,
      });
      toast({ title: "Contract deployed 🚀", description: `Live at ${shortAddr(deployedAddr)}` });
      loadMine();
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      const msg = err?.shortMessage || err?.message || String(e);
      setDeploy({ kind: "error", msg });
      setShowDeploy(false);
      setResultModal({ open: true, kind: "error", title: "Deploy Failed", subtitle: msg.slice(0, 200) });
    }
  };

  const activeTab = TABS.find((t) => t.value === tab)!;
  const isFactoryTab = tab === "factory";

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-teal-400">
            <Hammer className="h-3 w-3" /> Contract Forge · 1-Click Deploy
          </div>
          <h1 className="mt-3 font-display text-5xl">
            <span className="text-gradient-aurora">Create & Deploy</span>
          </h1>
          <p className="mt-1 text-sm text-white/40">
            Fill the form → deploy in one transaction · {feeEther} {LITVM_FACTORY_NATIVE_SYMBOL} fee · LitVM testnet
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-white/30">Factory</div>
            <button
              onClick={() => { navigator.clipboard.writeText(LITVM_FACTORY_ADDRESS); toast({ title: "Factory address copied" }); }}
              className="mt-0.5 flex items-center gap-1 font-mono text-sm text-white/70 hover:text-white"
            >
              {shortAddr(LITVM_FACTORY_ADDRESS)}
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-white/30">Deploy Fee</div>
            <div className="mt-0.5 font-display text-lg text-teal-400">{feeEther} {LITVM_FACTORY_NATIVE_SYMBOL}</div>
          </div>
        </div>
      </header>

      {/* ── Tab selector ── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.value
                ? "border-teal-500/60 bg-teal-600/20 text-teal-400"
                : "border-white/[0.07] bg-white/[0.03] text-white/40 hover:border-primary/20 hover:text-white/70"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Main form card ── */}
      <TiltCard tiltLimit={5} scale={1.01} className="rounded-2xl">
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117] p-6 md:p-8">

        {/* Tab header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-2.5">
            <activeTab.icon className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-white">{activeTab.label}</h2>
            <p className="mt-0.5 font-mono text-xs text-white/30">// {activeTab.desc}</p>
          </div>
        </div>

        {/* Panel */}
        {tab === "erc20" && <Erc20Panel form={erc20} setForm={setErc20} />}
        {tab === "nft" && <NftPanel form={nft} setForm={setNft} />}
        {tab === "staking" && <StakingPanel form={staking} setForm={setStaking} />}
        {tab === "vesting" && <VestingPanel form={vesting} setForm={setVesting} />}
        {tab === "factory" && <FactoryPanel form={factory} setForm={setFactory} />}

        {/* Factory notice */}
        {isFactoryTab && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/80">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p>Token Factory generates a <span className="font-semibold text-amber-300">source-only</span> template. Use <span className="font-semibold text-amber-300">Preview Source</span> to download the Solidity file, then deploy via Remix or Hardhat.</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={onGenerate}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white/70 transition-colors hover:border-primary/30 hover:text-white"
          >
            <Zap className="h-4 w-4" /> Preview Source
          </button>
          <button
            onClick={isFactoryTab ? onGenerate : onDeploy}
            disabled={deploy.kind === "deploying"}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border text-base font-semibold tracking-wide transition-colors disabled:opacity-60 ${
              isFactoryTab
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                : "border-teal-500/60 bg-teal-600/20 text-teal-400 hover:bg-primary/30"
            }`}
          >
            {deploy.kind === "deploying" && !isFactoryTab ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isFactoryTab ? (
              <Download className="h-5 w-5" />
            ) : (
              <Rocket className="h-5 w-5" />
            )}
            {isFactoryTab ? "Generate & Download" : `Deploy (${feeEther} ${LITVM_FACTORY_NATIVE_SYMBOL})`}
          </button>
        </div>
      </div>
      </TiltCard>

      {/* ── Source preview ── */}
      {code && (
        <div id="forge-output" className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1117]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-primary">{fileName}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Source preview
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:border-white/20 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:border-white/20 hover:text-white"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
          </div>
          <pre className="max-h-[600px] overflow-auto bg-black/20 p-5 font-mono text-xs leading-relaxed text-white/80">
            <code>{code}</code>
          </pre>
          <div className="flex items-start gap-2 border-t border-white/[0.07] bg-white/[0.02] px-5 py-3 text-[11px] text-white/30">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-primary" />
            <p>
              {isFactoryTab
                ? "Factory source template — deploy this contract manually via Remix, Hardhat, or Foundry."
                : `Reference source — your actual deployment uses the audited on-chain factory at `}
              {!isFactoryTab && <span className="font-mono text-white/50">{shortAddr(LITVM_FACTORY_ADDRESS)}</span>}
              {!isFactoryTab && "."}
            </p>
          </div>
        </div>
      )}

      {/* ── My deployed contracts ── */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117] p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg text-white">My Deployed Contracts</h3>
          </div>
          <button
            onClick={loadMine}
            disabled={!address}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50 hover:border-white/20 hover:text-white disabled:opacity-30"
          >
            Refresh
          </button>
        </div>

        {!address && (
          <p className="font-mono text-xs text-white/30">// Connect a wallet to see your deployments.</p>
        )}
        {address && myContracts.length === 0 && (
          <p className="font-mono text-xs text-white/30">// No contracts deployed yet from this address.</p>
        )}
        {myContracts.length > 0 && (
          <div className="space-y-2">
            {myContracts.map((c) => (
              <div
                key={c.address}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 transition-all hover:border-primary/30"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                      {FACTORY_TYPE_LABEL[c.type] ?? "?"}
                    </span>
                    <span className="truncate text-sm font-medium text-white">{c.label || "—"}</span>
                  </div>
                  <a
                    href={`${EXPLORER_URL}/address/${c.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] text-white/30 hover:text-primary"
                  >
                    {c.address}
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => navigator.clipboard.writeText(c.address)}
                    className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11px] text-white/40 hover:border-white/20 hover:text-white"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <a
                    href={`${EXPLORER_URL}/address/${c.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11px] text-white/40 hover:border-white/20 hover:text-white"
                  >
                    <ExternalLink className="h-3 w-3" /> Explorer
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DeployModal
        open={showDeploy}
        status={deploy}
        contractName={contractName}
        onClose={() => setShowDeploy(false)}
      />

      <TxResultModal
        open={resultModal.open}
        onClose={() => setResultModal((s) => ({ ...s, open: false }))}
        kind={resultModal.kind}
        title={resultModal.title}
        subtitle={resultModal.subtitle}
        txHash={resultModal.txHash}
        details={resultModal.details}
      />
    </div>
  );
}