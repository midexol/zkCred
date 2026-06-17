"use client";

import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Wallet,
  Copy,
  Check,
  ArrowRight,
  Lock,
  ChevronDown,
  Loader2,
  FileSearch,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Fingerprint,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Static data
// -----------------------------------------------------------------------------

const ASSETS = [
  { code: "USDC", name: "USD Coin", color: "bg-indigo-400" },
  { code: "XLM", name: "Stellar Lumens", color: "bg-violet-400" },
  { code: "EURC", name: "Euro Coin", color: "bg-sky-400" },
];

const MOCK_PROOF =
  "zkp_v1.eyJjaXJjdWl0IjoicG9mLXRocmVzaG9sZCIsImNvbW1pdG1lbnQiOiI4ZjNhMmIxZTljNmQ0ZjVhIn0.9f2c8e1a4b7d3f6e0c5a8b2d1e4f7a9c3b6d0e8f2a5c7b1d9e3f6a0c4b8d2e5f.QmX7vK2pR8mT4nL9sJ6wF3hG1dC5bA0eY";

const MOCK_TX_HASH =
  "7a3f9c1e6b4d8a2f5c0e9b3d7a1f4c8e2b6d0a9f3c7e1b5d8a2f6c0e4b9d3a7f";

// -----------------------------------------------------------------------------
// Small shared primitives
// -----------------------------------------------------------------------------

function truncateAddress(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function PulseDot({ color = "emerald" }: { color?: "emerald" | "violet" }) {
  const ring = color === "emerald" ? "bg-emerald-400" : "bg-violet-400";
  const core = color === "emerald" ? "bg-emerald-500" : "bg-violet-500";
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className={`absolute inline-flex h-full w-full rounded-full ${ring} opacity-60 animate-ping`}
      />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${core}`} />
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Tab control
// -----------------------------------------------------------------------------

type TabKey = "prover" | "verifier";

function TabSwitch({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <div className="relative inline-flex rounded-xl border border-white/10 bg-black/30 p-1 backdrop-blur-xl">
      <span
        className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-br from-violet-600/90 to-indigo-600/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_-8px_rgba(99,102,241,0.6)] transition-transform duration-300 ease-out ${
          active === "prover" ? "translate-x-0" : "translate-x-[calc(100%+4px)]"
        }`}
      />
      <button
        type="button"
        onClick={() => onChange("prover")}
        className={`relative z-10 flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors duration-300 ${
          active === "prover" ? "text-white" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <Fingerprint className="h-4 w-4" />
        Prover Mode
      </button>
      <button
        type="button"
        onClick={() => onChange("verifier")}
        className={`relative z-10 flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors duration-300 ${
          active === "verifier" ? "text-white" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <FileSearch className="h-4 w-4" />
        Verifier Mode
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prover Mode
// -----------------------------------------------------------------------------

function AssetDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = ASSETS.find((a) => a.code === value)!;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3.5 py-3 text-left text-sm text-zinc-100 transition-all duration-300 hover:border-white/20 focus:border-indigo-400/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        <span className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${selected.color}`} />
          <span className="font-medium">{selected.code}</span>
          <span className="text-zinc-500">{selected.name}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200">
          {ASSETS.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => {
                onChange(a.code);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-zinc-200 transition-colors duration-150 hover:bg-white/[0.06]"
            >
              <span className={`h-2 w-2 rounded-full ${a.color}`} />
              <span className="font-medium">{a.code}</span>
              <span className="text-zinc-500">{a.name}</span>
              {a.code === value && (
                <Check className="ml-auto h-3.5 w-3.5 text-emerald-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProverMode() {
  const [asset, setAsset] = useState("USDC");
  const [threshold, setThreshold] = useState("10,000");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [copied, setCopied] = useState(false);

  function generateProof() {
    setStatus("loading");
    setCopied(false);
    setTimeout(() => setStatus("done"), 1900);
  }

  function copyProof() {
    navigator.clipboard?.writeText(MOCK_PROOF).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid gap-5">
      {/* Wallet header */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-inset ring-indigo-400/20">
            <Wallet className="h-[18px] w-[18px] text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-zinc-100">
                GC32...4K91
              </span>
              <PulseDot color="emerald" />
              <span className="text-xs font-medium text-emerald-400">Connected</span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">Stellar mainnet · Freighter</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Balance</p>
          <p className="text-sm font-semibold text-zinc-100">42,318.96 USDC</p>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl">
        <SectionLabel>Proof parameters</SectionLabel>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Asset
            </label>
            <AssetDropdown value={asset} onChange={setAsset} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Minimum threshold
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                $
              </span>
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-900/60 py-3 pl-7 pr-3.5 text-sm font-medium text-zinc-100 transition-all duration-300 placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="10,000"
              />
            </div>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-zinc-500">
          <Lock className="mt-0.5 h-3 w-3 flex-shrink-0" />
          The exact balance is never revealed. The proof attests only that your
          holdings exceed the stated threshold.
        </p>

        <button
          type="button"
          onClick={generateProof}
          disabled={status === "loading"}
          className="group mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.5)] transition-all duration-300 hover:shadow-[0_8px_28px_-6px_rgba(99,102,241,0.7)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating zero-knowledge proof…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              Generate ZK Proof
            </>
          )}
        </button>
      </div>

      {/* Loading skeleton */}
      {status === "loading" && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-violet-500/60" />
            <div className="h-2.5 w-40 animate-pulse rounded bg-white/10" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-2.5 w-full animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2.5 w-5/6 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
      )}

      {/* Success state */}
      {status === "done" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-400/30">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-emerald-300">
              Proof generated successfully
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3.5 py-3">
            <code className="overflow-x-auto whitespace-nowrap text-xs text-zinc-400 font-mono">
              {MOCK_PROOF}
            </code>
            <button
              type="button"
              onClick={copyProof}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Share this proof string with any verifier. It carries no wallet
            identity or balance data beyond the threshold attestation.
          </p>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Verifier Mode
// -----------------------------------------------------------------------------

function VerifierMode() {
  const [proofInput, setProofInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "verified" | "invalid">(
    "idle"
  );

  function runVerification() {
    if (!proofInput.trim()) {
      setStatus("invalid");
      return;
    }
    setStatus("loading");
    setTimeout(() => setStatus("verified"), 1600);
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl">
        <SectionLabel>Submit proof for verification</SectionLabel>

        <textarea
          value={proofInput}
          onChange={(e) => {
            setProofInput(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder="Paste the zkCred proof string here (e.g. zkp_v1.eyJjaXJjdWl0Ijoi...)"
          rows={4}
          className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3.5 py-3 font-mono text-sm text-zinc-200 transition-all duration-300 placeholder:text-zinc-600 hover:border-white/20 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />

        <button
          type="button"
          onClick={runVerification}
          disabled={status === "loading"}
          className="group mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.5)] transition-all duration-300 hover:shadow-[0_8px_28px_-6px_rgba(99,102,241,0.7)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running on-chain verification…
            </>
          ) : (
            <>
              Run On-Chain Verification
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>

      {/* Result panel: invalid / empty input */}
      {status === "invalid" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-5 backdrop-blur-xl">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-inset ring-rose-400/30">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-300">No proof submitted</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Paste a valid zkCred proof string above before running verification.
            </p>
          </div>
        </div>
      )}

      {/* Result panel: loading */}
      {status === "loading" && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            <p className="text-sm text-zinc-400">
              Checking circuit constraints against Stellar ledger state…
            </p>
          </div>
        </div>
      )}

      {/* Result panel: verified */}
      {status === "verified" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-400/30">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-emerald-300">
                VERIFIED: Wallet assets exceed threshold
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Zero-knowledge attestation confirmed on Stellar mainnet
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-emerald-400/10 pt-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                On-chain timestamp
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-200">
                {new Date().toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Transaction hash
              </p>
              <a
                href="#"
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                }}
                className="mt-1 flex items-center gap-1.5 text-sm font-medium text-emerald-400 transition-colors duration-200 hover:text-emerald-300"
              >
                <span className="font-mono">{truncateAddress(MOCK_TX_HASH)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function ZkCredDashboard() {
  const [tab, setTab] = useState<TabKey>("prover");

  return (
    <div className="min-h-screen bg-zinc-950 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.12),transparent)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 ring-1 ring-inset ring-white/10">
              <Sparkles className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-50">
                zkCred
              </h1>
              <p className="text-xs text-zinc-500">Privacy-preserving proof of funds</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Stellar Testnet
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex justify-center">
          <TabSwitch active={tab} onChange={setTab} />
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 p-1 shadow-2xl shadow-black/40">
          <div className="rounded-[14px] bg-black/20 p-5 sm:p-6">
            {tab === "prover" ? <ProverMode /> : <VerifierMode />}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Built for the Stellar Real-World ZK hackathon · No balance data leaves your
          device
        </p>
      </div>
    </div>
  );
}