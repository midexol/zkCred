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
  ExternalLink,
  Sparkles,
  AlertCircle,
  Menu,
  X,
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
// Navigation and View Management
// ---------------------------------------------------------------

type ViewKey = "home" | "prover" | "verifier";

// Header Navigation Component
function ViewNavigation({
  active,
  onNavigate,
  walletConnected,
  onWalletToggle,
}: {
  active: ViewKey;
  onNavigate: (v: ViewKey) => void;
  walletConnected: boolean;
  onWalletToggle: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function navigate(view: ViewKey) {
    onNavigate(view);
    setMobileMenuOpen(false);
  }

  const navLinks: { label: string; view: ViewKey }[] = [
    { label: "Home", view: "home" },
    { label: "Prover Dashboard", view: "prover" },
    { label: "Auditor Portal", view: "verifier" },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-zinc-950/80 border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          className="flex items-center space-x-2.5 cursor-pointer"
          onClick={() => navigate("home")}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-950 font-bold" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              zkCred
            </span>
            <span className="block text-[9px] sm:text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
              Stellar ZK Layer
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex space-x-8 text-sm font-medium">
          {navLinks.map(({ label, view }) => (
            <button
              key={view}
              onClick={() => navigate(view)}
              className={`px-1 py-2 transition duration-150 ${
                active === view
                  ? "text-emerald-400 border-b-2 border-emerald-500"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right side: wallet + hamburger */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onWalletToggle}
            className={`flex items-center ${
              walletConnected
                ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200"
                : "bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-extrabold"
            } px-3 sm:px-4 py-2 rounded-lg transition duration-200 text-xs sm:text-sm font-medium`}
          >
            {walletConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                <span className="font-mono">GC32...4K91</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4 mr-1.5 sm:mr-2" />
                <span className="hidden xs:inline">Connect </span>Freighter
              </>
            )}
          </button>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-zinc-950/95 backdrop-blur-md">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {navLinks.map(({ label, view }) => (
              <button
                key={view}
                onClick={() => navigate(view)}
                className={`text-left px-3 py-3 rounded-lg text-sm font-medium transition duration-150 ${
                  active === view
                    ? "text-emerald-400 bg-emerald-950/40 border border-emerald-900/50"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

// Landing Home Page Component
function LandingHome({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  return (
    <div className="relative">
      {/* Hero Section */}
      <div className="relative py-14 sm:py-20 lg:py-32 overflow-hidden w-full">
        {/* Glowing background accents */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[500px] h-[280px] sm:h-[500px] bg-emerald-500/10 blur-[80px] sm:blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[180px] sm:w-[300px] h-[180px] sm:h-[300px] bg-blue-500/10 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Tech Badge */}
          <div className="inline-flex items-center space-x-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] sm:text-xs font-mono text-emerald-400 font-medium tracking-wide">
              Stellar Protocol 25 BN254 Native
            </span>
          </div>

          {/* Hero Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-tight sm:leading-none mb-5 sm:mb-6">
            Prove Your Funds.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
              Keep Your Privacy.
            </span>
          </h1>

          {/* Hero Subtitle */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed mb-8 sm:mb-10 px-2">
            Zero-Knowledge compliance infrastructure for Stellar. Generate secure
            on-device balance proofs for landlords, creditors, or compliance audits
            without exposing your public key or history.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 w-full max-w-sm sm:max-w-md mx-auto">
            <button
              onClick={() => onNavigate("prover")}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold px-8 py-3.5 sm:py-4 rounded-xl shadow-lg shadow-emerald-500/15 transition-all transform hover:-translate-y-0.5 duration-150 text-sm sm:text-base"
            >
              Prove My Balance
            </button>
            <button
              onClick={() => onNavigate("verifier")}
              className="w-full sm:w-auto bg-slate-900/90 text-slate-200 border border-slate-800 hover:border-slate-700 font-bold px-8 py-3.5 sm:py-4 rounded-xl transition-all transform hover:-translate-y-0.5 duration-150 text-sm sm:text-base"
            >
              Audit a Proof
            </button>
          </div>

          {/* Trust Bar */}
          <div className="mt-14 sm:mt-20 border-t border-slate-900/60 pt-8 sm:pt-10">
            <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-slate-500 mb-5 sm:mb-6">
              Built & Deployed On Secure Infrastructure
            </p>
            <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-16 opacity-50 grayscale hover:opacity-80 transition-all">
              <span className="text-slate-300 font-semibold text-sm sm:text-lg">STELLAR HORIZON</span>
              <span className="text-slate-300 font-semibold text-sm sm:text-lg">SOROBAN CONTRACTS</span>
              <span className="text-slate-300 font-semibold text-sm sm:text-lg">NOIR CRYPTO</span>
            </div>
          </div>
        </div>
      </div>

      {/* Problem vs Solution Matrix */}
      <div className="py-14 sm:py-20 bg-slate-950/40 border-t border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4 px-2">
              Why the industry requires Zero-Knowledge Proofs
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base px-2">
              Traditional proof-of-funds techniques put both your finances and
              identity at perpetual risk.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Red Flag Card */}
            <div className="bg-slate-900/50 border border-red-950/50 rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl"></div>
              <span className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest bg-red-950/40 px-3 py-1 rounded-md">
                Traditional Method
              </span>
              <h3 className="text-xl font-bold text-slate-100 mt-4 mb-6">
                Exposing Public Wallet Addresses
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start text-slate-400 text-sm">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                  <span>
                    Auditor views exact, real-time balances of all crypto-assets.
                  </span>
                </li>
                <li className="flex items-start text-slate-400 text-sm">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                  <span>
                    Total transaction history is cataloged and linkable to your
                    physical identity.
                  </span>
                </li>
                <li className="flex items-start text-slate-400 text-sm">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                  <span>
                    Increases vectors for physical threat, targeting, and custom
                    spear-phishing.
                  </span>
                </li>
              </ul>
            </div>

            {/* Green Flag Card */}
            <div className="bg-slate-900/50 border border-emerald-950/50 rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl"></div>
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/40 px-3 py-1 rounded-md">
                zkCred Standard
              </span>
              <h3 className="text-xl font-bold text-slate-100 mt-4 mb-6">
                Cryptographic Security Shield
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start text-slate-400 text-sm">
                  <Check className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" />
                  <span>
                    Lender only receives binary{" "}
                    <strong className="text-emerald-400 font-semibold">TRUE</strong>{" "}
                    confirming you exceed the threshold.
                  </span>
                </li>
                <li className="flex items-start text-slate-400 text-sm">
                  <Check className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" />
                  <span>
                    Your private key and absolute balance never leave the browser
                    runtime.
                  </span>
                </li>
                <li className="flex items-start text-slate-400 text-sm">
                  <Check className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" />
                  <span>
                    Compliant cryptographic output verifies on-chain in seconds via
                    Soroban.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Process Step-by-Step Timeline */}
      <div className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4 px-2">
              How does the mathematical circuit work?
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base px-2">
              Generate, distribute, and verify cryptographically valid proofs in 3
              fast steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Background Connector Line */}
            <div className="hidden md:block absolute top-1/2 left-1/12 right-1/12 h-[2px] bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-slate-800 -translate-y-12 -z-10"></div>

            {/* Step 1 */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 text-center hover:border-slate-700/80 transition duration-300">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-6 border border-slate-700 text-emerald-400 font-mono font-bold text-lg shadow-md shadow-emerald-500/5">
                1
              </div>
              <h4 className="text-lg font-bold text-slate-100 mb-2">
                Connect & Read Balance
              </h4>
              <p className="text-sm text-slate-400">
                Connect securely via Freighter. zkCred fetches your public token
                values straight from the Stellar Testnet.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 text-center hover:border-slate-700/80 transition duration-300">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-6 border border-slate-700 text-blue-400 font-mono font-bold text-lg shadow-md shadow-blue-500/5">
                2
              </div>
              <h4 className="text-lg font-bold text-slate-100 mb-2">
                Generate Local ZKP
              </h4>
              <p className="text-sm text-slate-400">
                Specify your threshold. Our client-side Noir engine runs
                mathematical parameters directly inside your browser to produce
                proof π.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 text-center hover:border-slate-700/80 transition duration-300">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-6 border border-slate-700 text-teal-400 font-mono font-bold text-lg shadow-md shadow-teal-500/5">
                3
              </div>
              <h4 className="text-lg font-bold text-slate-100 mb-2">
                On-Chain Smart Validation
              </h4>
              <p className="text-sm text-slate-400">
                The auditor uploads the mathematical code. Soroban contracts execute
                native validation checks and return verified trust states.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab control

// Prover Mode
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
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 px-4 sm:px-5 py-4 backdrop-blur-xl min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-inset ring-indigo-400/20">
            <Wallet className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-indigo-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium text-zinc-100">GC32...4K91</span>
              <PulseDot color="emerald" />
              <span className="text-xs font-medium text-emerald-400">Connected</span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">Stellar mainnet · Freighter</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
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

          <div className="mt-4 rounded-lg border border-white/10 bg-black/40 px-3.5 py-3">
            <div className="overflow-hidden">
              <code className="break-all text-xs text-zinc-400 font-mono block pb-1 leading-relaxed">
                {MOCK_PROOF}
              </code>
            </div>
            <div className="flex justify-end mt-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={copyProof}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy proof
                  </>
                )}
              </button>
            </div>
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
  const [currentView, setCurrentView] = useState<ViewKey>("home");
  const [walletConnected, setWalletConnected] = useState(false);

  const handleNavigate = (view: ViewKey) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWalletToggle = () => {
    setWalletConnected((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col overflow-x-hidden">
      {/* Navigation Header */}
      <ViewNavigation
        active={currentView}
        onNavigate={handleNavigate}
        walletConnected={walletConnected}
        onWalletToggle={handleWalletToggle}
      />

      {/* Main Content */}
      <main className="flex-grow">
        {currentView === "home" && <LandingHome onNavigate={handleNavigate} />}

        {currentView === "prover" && (
          <section className="py-8 sm:py-12 max-w-4xl mx-auto px-4 w-full">
            <div className="mb-8 sm:mb-10 text-center">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-3 py-1.5 rounded-full">
                Prover Environment
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-4 mb-2 px-2">
                On-Device Zero-Knowledge Generator
              </h2>
              <p className="text-slate-400 text-sm sm:text-base px-2">
                Establish minimum threshold certifications locally. Your keys and
                balances are never transmitted to any API server.
              </p>
            </div>

            {walletConnected ? (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 p-1 shadow-2xl shadow-black/40">
                <div className="rounded-[14px] bg-black/20 p-4 sm:p-6">
                  <ProverMode />
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-800/80 border border-slate-700 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6">
                  <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                  Wallet Disconnected
                </h3>
                <p className="text-slate-400 max-w-md mx-auto mb-6 text-sm sm:text-base">
                  To scan live asset accounts from the Stellar network, connect your
                  authorized Freighter wallet.
                </p>
                <button
                  onClick={handleWalletToggle}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-extrabold px-6 py-3 rounded-xl transition duration-200 text-sm sm:text-base"
                >
                  Connect Stellar Wallet
                </button>
              </div>
            )}
          </section>
        )}

        {currentView === "verifier" && (
          <section className="py-8 sm:py-12 max-w-4xl mx-auto px-4 w-full">
            <div className="mb-8 sm:mb-10 text-center">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400 bg-blue-950/40 border border-blue-900/50 px-3 py-1.5 rounded-full">
                Auditor Verification Portal
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-4 mb-2 px-2">
                Stellar Soroban Proof Auditor
              </h2>
              <p className="text-slate-400 text-sm sm:text-base px-2">
                Instantly execute on-chain BN254 host parameters. Verify physical
                asset solvency without ever learning identities.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 p-1 shadow-2xl shadow-black/40">
              <div className="rounded-[14px] bg-black/20 p-4 sm:p-6">
                <VerifierMode />
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Global Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-5 sm:gap-6">
          <div className="text-center md:text-left">
            <span className="text-sm font-bold text-white">
              zkCred — Cryptographic Proof of Funds
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Stellar Global Hacker Series Submission.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">
              Architecture Specs
            </a>
            <a href="#" className="hover:text-slate-300 transition-colors">
              Soroban Verifier Source
            </a>
            <a href="#" className="hover:text-slate-300 transition-colors">
              Noir Circuit Schema
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}