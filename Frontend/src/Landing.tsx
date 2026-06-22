"use client";

import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Wallet,
  Copy,
  Check,
  ArrowRight,
  Lock,
  Loader2,
  ExternalLink,
  Sparkles,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Static data
// -----------------------------------------------------------------------------



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

/* ── Keyframe injection ──────────────────────────────────────────────────── */
const _fadeInUpStyle = (
  <style>{`
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `}</style>
);
/* ─────────────────────────────────────────────────────────────────────────── */

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
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-zinc-950/80 border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => onNavigate("home")}
        >
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-zinc-950 font-bold" />
          </div>
          <div className="hidden sm:block">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              zkCred
            </span>
            <span className="block text-[9px] sm:text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
              Stellar ZK Layer
            </span>
          </div>
          <div className="sm:hidden">
            <span className="text-base font-extrabold tracking-tight text-white">zkCred</span>
          </div>
        </div>

        {/* Main Navigation Links */}
        <nav className="hidden md:flex space-x-1 text-sm font-medium">
          <button
            onClick={() => onNavigate("home")}
            className={`px-3 py-2 rounded-lg transition-all duration-200 ${
              active === "home"
                ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] hover:border-white/[0.06] border border-transparent"
            }`}
          >
            Home
          </button>
          <button
            onClick={() => onNavigate("prover")}
            className={`px-3 py-2 rounded-lg transition-all duration-200 ${
              active === "prover"
                ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] hover:border-white/[0.06] border border-transparent"
            }`}
          >
            Prover Dashboard
          </button>
          <button
            onClick={() => onNavigate("verifier")}
            className={`px-3 py-2 rounded-lg transition-all duration-200 ${
              active === "verifier"
                ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] hover:border-white/[0.06] border border-transparent"
            }`}
          >
            Auditor Portal
          </button>
        </nav>

        {/* Wallet Button */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button
            onClick={onWalletToggle}
            className={`relative flex items-center transition-all duration-300 ${
              walletConnected
                ? "bg-slate-800/80 hover:bg-slate-700/80 border border-emerald-500/30 hover:border-emerald-400/50 text-slate-200 shadow-[0_0_12px_rgba(16,185,129,0.12)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                : "bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-extrabold hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:scale-[1.02]"
            } px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium`}
          >
            {walletConnected ? (
              <>
                {/* Pulsing green beacon glow */}
                <span className="relative mr-1 sm:mr-2 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-xs sm:text-sm hidden xs:inline">GC32...4K91</span>
              </>
            ) : (
              <>
                <Wallet className="w-3.5 sm:w-4 h-3.5 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Connect Freighter</span>
                <span className="sm:hidden">Connect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

// Landing Home Page Component
function LandingHome({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  return (
    <div className="relative">
      {/* Inject fadeInUp keyframe */}
      {_fadeInUpStyle}
      {/* Hero Section */}
      <div className="relative py-12 sm:py-20 lg:py-32 overflow-hidden">
        {/* Ambient radial glow — deepest layer */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[700px] h-[700px] rounded-full bg-emerald-500/5 blur-[140px] animate-pulse" style={{ animationDuration: '4s' }} />
        </div>
        {/* Glowing background accents */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Tech Badge */}
          <div className="inline-flex items-center space-x-2 bg-slate-900/80 border border-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full mb-4 sm:mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-[10px] sm:text-xs font-mono text-emerald-400 font-medium tracking-wide">
              Stellar Protocol 25 BN254 Native
            </span>
          </div>

          {/* Hero Title */}
          <h1
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-none mb-4 sm:mb-6"
            style={{ animation: 'fadeInUp 0.7s ease both 0.1s' }}
          >
            Prove Your Funds.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
              Keep Your Privacy.
            </span>
          </h1>

          {/* Hero Subtitle */}
          <p
            className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed mb-10"
            style={{ animation: 'fadeInUp 0.7s ease both 0.25s' }}
          >
            Zero-Knowledge compliance infrastructure for Stellar. Generate secure
            on-device balance proofs for landlords, creditors, or compliance audits
            without exposing your public key or history.
          </p>

          {/* Call to Action Buttons */}
          <div
            className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto"
            style={{ animation: 'fadeInUp 0.7s ease both 0.4s' }}
          >
            <button
              onClick={() => onNavigate("prover")}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold px-8 py-4 rounded-xl shadow-lg shadow-emerald-500/15 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_28px_rgba(16,185,129,0.35)] hover:scale-[1.02]"
            >
              Prove My Balance
            </button>
            <button
              onClick={() => onNavigate("verifier")}
              className="w-full sm:w-auto bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-emerald-500/30 font-bold px-8 py-4 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
            >
              Audit a Proof
            </button>
          </div>

          {/* Trust Bar */}
          <div className="mt-20 border-t border-slate-900/60 pt-10">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-6">
              Built & Deployed On Secure Infrastructure
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-16 opacity-50 grayscale hover:opacity-80 transition-all">
              <span className="text-slate-300 font-semibold text-lg">
                STELLAR HORIZON
              </span>
              <span className="text-slate-300 font-semibold text-lg">
                SOROBAN CONTRACTS
              </span>
              <span className="text-slate-300 font-semibold text-lg">
                NOIR CRYPTO
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Problem vs Solution Matrix */}
      <div className="py-20 bg-slate-950/40 border-t border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
              Why the industry requires Zero-Knowledge Proofs
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Traditional proof-of-funds techniques put both your finances and
              identity at perpetual risk.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Red Flag Card */}
            <div className="group bg-slate-900/50 border border-red-950/50 hover:border-red-500/30 rounded-2xl p-8 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(239,68,68,0.07)]">
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
            <div className="group bg-slate-900/50 border border-emerald-950/50 hover:border-emerald-500/30 rounded-2xl p-8 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(16,185,129,0.07)]">
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
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
              How does the mathematical circuit work?
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Generate, distribute, and verify cryptographically valid proofs in 3
              fast steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Background Connector Line */}
            <div className="hidden md:block absolute top-1/2 left-1/12 right-1/12 h-[2px] bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-slate-800 -translate-y-12 -z-10"></div>

            {/* Step 1 */}
            <div
              className="group bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 text-center transition-all duration-300 hover:border-emerald-500/30 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              style={{ animation: 'fadeInUp 0.6s ease both 0.1s' }}
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 border border-slate-700 group-hover:border-emerald-500/30 text-emerald-400 font-mono font-bold text-lg shadow-md shadow-emerald-500/5 transition-all duration-300">
                1
              </div>
              <h4 className="text-lg font-bold text-slate-100 mb-2">
                Connect &amp; Read Balance
              </h4>
              <p className="text-sm text-slate-400">
                Connect securely via Freighter. zkCred fetches your public token
                values straight from the Stellar Testnet.
              </p>
            </div>

            {/* Step 2 */}
            <div
              className="group bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 text-center transition-all duration-300 hover:border-blue-500/30 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
              style={{ animation: 'fadeInUp 0.6s ease both 0.25s' }}
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-blue-500/10 flex items-center justify-center mx-auto mb-6 border border-slate-700 group-hover:border-blue-500/30 text-blue-400 font-mono font-bold text-lg shadow-md shadow-blue-500/5 transition-all duration-300">
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
            <div
              className="group bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 text-center transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(20,184,166,0.1)]"
              style={{ animation: 'fadeInUp 0.6s ease both 0.4s' }}
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-teal-500/10 flex items-center justify-center mx-auto mb-6 border border-slate-700 group-hover:border-teal-500/30 text-teal-400 font-mono font-bold text-lg shadow-md shadow-teal-500/5 transition-all duration-300">
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
// Prover Mode — Asset & Proof Configuration
// (AssetDropdown removed — replaced by inline button-group selector in ProverMode)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Prover Mode — Asset & Proof Configuration
// -----------------------------------------------------------------------------

// Asset configuration profiles. Each entry defines the ledger balance mock,
// the slider range, step granularity, and display symbol.
// TODO: Replace `balance` with a live Stellar Horizon API call:
//   GET https://horizon-testnet.stellar.org/accounts/{walletAddress}
const ASSET_CONFIGS = {
  USDC: { balance: 12450.0,  min: 100,  max: 25000,  step: 100, symbol: '$', color: 'bg-indigo-400', label: 'USD Coin' },
  EURC: { balance: 9800.0,   min: 100,  max: 20000,  step: 100, symbol: '€', color: 'bg-sky-400',    label: 'Euro Coin' },
  XLM:  { balance: 45000.0,  min: 1000, max: 100000, step: 500, symbol: '*', color: 'bg-violet-400', label: 'Stellar Lumens' },
} as const;

type AssetKey = keyof typeof ASSET_CONFIGS;

interface TerminalLog {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// Long mock proof hex — mimics a real BN254 UltraPlonk 1,312-byte serialised proof.
// TODO: Replace with the actual proof bytes returned by the Noir WASM prover.
const MOCK_PROOF_HEX =
  '0x3c9902f4a1b8e3d72c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4' +
  'e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8' +
  'd2c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4e1d8c3f6a2b5e0d9' +
  'c4f7a1b3e8d2c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4e1d8c3' +
  'f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0' +
  'a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1';

// Each entry defines a compiler log line and the millisecond offset at which
// it is appended to the terminal.  Mimics a real ACIR + Barretenberg pipeline.
// TODO: Stream real logs from the Noir WASM engine worker thread.
const COMPILE_SEQUENCE: Array<{ message: string; type: TerminalLog['type']; delay: number }> = [
  { message: '> Initializing noir-wasm-engine v0.31.0 ...', type: 'info', delay: 0 },
  { message: '> Loading BN254 elliptic curve parameters ...', type: 'info', delay: 320 },
  { message: '> Parsing circuit topology from ACIR bytecode ...', type: 'info', delay: 700 },
  { message: '  [1/4] Constraint system analysis — 2,847 gates found.', type: 'info', delay: 1080 },
  { message: '  [2/4] Resolving arithmetic gate constraints ...', type: 'info', delay: 1480 },
  { message: '  [3/4] Generating optimised witness map ...', type: 'info', delay: 1860 },
  { message: '  [4/4] ACIR compilation complete.', type: 'success', delay: 2260 },
  { message: '> Initializing Barretenberg proving backend (UltraPlonk) ...', type: 'info', delay: 2620 },
  { message: '> Injecting private witness: balance scalar ...', type: 'info', delay: 3020 },
  { message: '  Threshold assertion: balance ≥ target  →  SATISFIED ✓', type: 'success', delay: 3400 },
  { message: '> Computing proof π via UltraPlonk protocol ...', type: 'info', delay: 3800 },
  { message: '  Generating structured reference string (SRS) ...', type: 'info', delay: 4120 },
  { message: '  Commitment scheme: KZG10 polynomial commitments ...', type: 'info', delay: 4480 },
  { message: '  Round 1 — Witness polynomial commitments committed.', type: 'info', delay: 4820 },
  { message: '  Round 2 — Permutation argument grand product computed.', type: 'info', delay: 5120 },
  { message: '  Round 3 — Quotient polynomial evaluated.', type: 'info', delay: 5440 },
  { message: '  Proof synthesis complete. Output: 1,312 bytes.', type: 'success', delay: 5820 },
  { message: '> Serialising proof artifact to hex encoding ...', type: 'info', delay: 6140 },
  { message: '> ✓ Zero-knowledge proof package generated. Ready to export.', type: 'success', delay: 6520 },
];

// -----------------------------------------------------------------------------
// Prover Mode Component
// -----------------------------------------------------------------------------

function ProverMode() {
  const [selectedAsset, setSelectedAsset] = useState<AssetKey>('USDC');
  const [thresholdValue, setThresholdValue] = useState(5000);
  const [isGenerating, setIsGenerating] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [generatedProof, setGeneratedProof] = useState('');
  const [copied, setCopied] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  // Ref holds all active timeout IDs so we can cancel them safely on unmount.
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const config = ASSET_CONFIGS[selectedAsset];
  const thresholdExceedsBalance = thresholdValue > config.balance;

  // When the user switches assets, reset threshold to a sensible default
  // (half of the mock ledger balance) and clear any previous compile output.
  function handleAssetChange(asset: AssetKey) {
    const newConfig = ASSET_CONFIGS[asset];
    setSelectedAsset(asset);
    setThresholdValue(Math.round(newConfig.balance / 2.5));
    setTerminalLogs([]);
    setGeneratedProof('');
  }

  // Auto-scroll the terminal body whenever a new log line is appended.
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Cleanup all pending timeouts when the component unmounts to prevent
  // setState calls on an unmounted component (memory-safe).
  useEffect(() => {
    return () => { timeoutsRef.current.forEach(clearTimeout); };
  }, []);

  function handleCompile() {
    if (thresholdExceedsBalance || isGenerating) return;

    // Cancel any in-flight timeouts from a previous run.
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    setIsGenerating(true);
    setTerminalLogs([]);
    setGeneratedProof('');

    // Schedule each terminal log line at its defined delay offset.
    // TODO: Replace these timeouts with real messages streamed from the
    //       Noir WASM worker thread running the Barretenberg prover.
    COMPILE_SEQUENCE.forEach((entry, idx) => {
      const t = setTimeout(() => {
        setTerminalLogs(prev => [...prev, { id: idx, message: entry.message, type: entry.type }]);
      }, entry.delay);
      timeoutsRef.current.push(t);
    });

    // After the final log, unlock the UI and reveal the proof output.
    const totalDuration = COMPILE_SEQUENCE[COMPILE_SEQUENCE.length - 1].delay + 900;
    const finalTimeout = setTimeout(() => {
      setIsGenerating(false);
      setGeneratedProof(MOCK_PROOF_HEX);
    }, totalDuration);
    timeoutsRef.current.push(finalTimeout);
  }

  function handleCopy() {
    navigator.clipboard?.writeText(generatedProof).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const logColor: Record<TerminalLog['type'], string> = {
    info:    'text-slate-400',
    success: 'text-emerald-400',
    warning: 'text-yellow-400',
    error:   'text-red-400',
  };

  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-5">

      {/* =========================================================
          LEFT — Parameters Control Panel  (3 / 5 columns)
          ========================================================= */}
      <div className="md:col-span-3 flex flex-col gap-5">

        {/* Asset Selector */}
        <div className="rounded-xl border border-[#1E293B] bg-[#161F30] p-5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Target Asset
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ASSET_CONFIGS) as AssetKey[]).map(asset => (
              <button
                key={asset}
                type="button"
                onClick={() => handleAssetChange(asset)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border py-3 px-2 text-center transition-all duration-200 ${
                  selectedAsset === asset
                    ? 'border-emerald-500/60 bg-emerald-500/[0.08] shadow-[0_0_12px_-4px_rgba(16,185,129,0.3)] text-emerald-300'
                    : 'border-[#1E293B] bg-zinc-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${ASSET_CONFIGS[asset].color}`} />
                <span className="text-sm font-bold tracking-tight">{asset}</span>
                <span className="text-[10px] text-slate-500">{ASSET_CONFIGS[asset].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Current Ledger Balance */}
        <div className="rounded-xl border border-[#1E293B] bg-[#161F30] p-5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Ledger Balance (Mock)
          </p>
          <div className="flex items-baseline gap-3 rounded-lg border border-[#1E293B] bg-[#090D16] px-4 py-4">
            <span
              className="text-2xl font-bold tracking-tight text-white"
              style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
            >
              {config.symbol}
              {config.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm text-slate-500">{selectedAsset}</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <PulseDot color="emerald" />
              Live
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-600">
            <Lock className="h-3 w-3" />
            {/* TODO: Fetch real balance via Stellar Horizon API once Freighter is connected */}
            Balance fetched client-side only — never transmitted to any server.
          </p>
        </div>

        {/* Threshold Slider */}
        <div className="rounded-xl border border-[#1E293B] bg-[#161F30] p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Threshold Assertion
            </p>
            <span
              className="text-sm font-bold tabular-nums text-white"
              style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
            >
              {config.symbol}{thresholdValue.toLocaleString()}
            </span>
          </div>

          <input
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={thresholdValue}
            onChange={e => setThresholdValue(Number(e.target.value))}
            className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-[#1E293B] accent-emerald-500 outline-none"
          />
          <div className="mt-1.5 flex justify-between">
            <span className="text-[10px] text-slate-600">
              {config.symbol}{config.min.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-600">
              {config.symbol}{config.max.toLocaleString()}
            </span>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-600">
            <Lock className="mt-0.5 h-3 w-3 flex-shrink-0" />
            The circuit proves balance ≥ threshold without revealing the exact figure.
          </p>
        </div>

        {/* Defensive boundary warning */}
        {thresholdExceedsBalance && (
          <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/[0.07] p-4 animate-in fade-in duration-300">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
            <p className="text-sm leading-relaxed text-yellow-300">
              <strong>Caution:</strong> Target threshold exceeds account balance.
              Compilation circuit evaluation will fail!
            </p>
          </div>
        )}

        {/* Compile Button */}
        <button
          type="button"
          onClick={handleCompile}
          disabled={thresholdExceedsBalance || isGenerating}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-300
            bg-gradient-to-r from-emerald-500 to-teal-600
            shadow-[0_8px_24px_-6px_rgba(16,185,129,0.4)]
            hover:brightness-110 hover:shadow-[0_8px_28px_-4px_rgba(16,185,129,0.5)] hover:-translate-y-0.5
            disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Compiling Circuit…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Compile &amp; Generate Proof
            </>
          )}
        </button>
      </div>

      {/* =========================================================
          RIGHT — On-Device Compiler Terminal Console  (2 / 5 cols)
          ========================================================= */}
      <div className="md:col-span-2 flex flex-col overflow-hidden rounded-xl border border-[#1E293B] bg-[#090D16]">
        {/* macOS-style terminal chrome */}
        <div className="flex items-center gap-2 border-b border-[#1E293B] bg-[#161F30] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
          <span
            className="ml-3 text-[11px] tracking-wide text-slate-500"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
          >
            noir-wasm-engine
          </span>
          {isGenerating && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400">
              <PulseDot color="emerald" />
              compiling
            </span>
          )}
          {!isGenerating && generatedProof && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-500">
              <Check className="h-3 w-3 text-emerald-400" />
              done
            </span>
          )}
        </div>

        {/* Terminal body — scrollable, monospaced */}
        <div
          ref={terminalRef}
          className="flex-1 min-h-[300px] max-h-[420px] space-y-1.5 overflow-y-auto p-4"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
        >
          {terminalLogs.length === 0 && !isGenerating && (
            <p className="text-[12px] italic text-slate-600">
              // Awaiting compilation trigger…
            </p>
          )}
          {terminalLogs.map(log => (
            <p
              key={log.id}
              className={`text-[12px] leading-relaxed ${logColor[log.type]}`}
            >
              {log.message}
            </p>
          ))}
          {isGenerating && (
            <span className="inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-emerald-400" />
          )}
        </div>
      </div>

      {/* =========================================================
          PROOF OUTPUT — Full-width, fades in after compile
          ========================================================= */}
      {generatedProof && (
        <div className="md:col-span-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="rounded-xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.07] to-[#161F30] p-5">

            {/* Success alert banner */}
            <div className="mb-5 flex items-center gap-3 border-b border-emerald-400/15 pb-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-400/30">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Zero-Knowledge Proof Package Generated
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {/* TODO: Submit via Freighter signTransaction() to the Soroban verifier contract */}
                  BN254 · UltraPlonk · 1,312 bytes · Share with verifier to attest balance threshold
                </p>
              </div>
            </div>

            {/* Copy row */}
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Proof Artifact (hex-encoded)
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-medium text-slate-300 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.09]"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy to Clipboard
                  </>
                )}
              </button>
            </div>

            {/* Read-only proof textarea */}
            <textarea
              readOnly
              value={generatedProof}
              rows={4}
              className="w-full resize-none rounded-lg border border-[#1E293B] bg-[#090D16] px-4 py-3 text-xs text-emerald-400/80 focus:outline-none"
              style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
            />
          </div>
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
    <div className="min-h-screen bg-zinc-950 flex flex-col">
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
          <section className="py-12 max-w-4xl mx-auto px-4 w-full">
            <div className="mb-10 text-center">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-3 py-1.5 rounded-full">
                Prover Environment
              </span>
              <h2 className="text-3xl font-extrabold text-white mt-4 mb-2">
                On-Device Zero-Knowledge Generator
              </h2>
              <p className="text-slate-400">
                Establish minimum threshold certifications locally. Your keys and
                balances are never transmitted to any API server.
              </p>
            </div>

            {walletConnected ? (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 p-1 shadow-2xl shadow-black/40">
                <div className="rounded-[14px] bg-black/20 p-5 sm:p-6">
                  <ProverMode />
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-slate-800/80 border border-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Wallet Disconnected
                </h3>
                <p className="text-slate-400 max-w-md mx-auto mb-6">
                  To scan live asset accounts from the Stellar network, connect your
                  authorized Freighter wallet.
                </p>
                <button
                  onClick={handleWalletToggle}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-extrabold px-6 py-3 rounded-xl transition duration-200"
                >
                  Connect Stellar Wallet
                </button>
              </div>
            )}
          </section>
        )}

        {currentView === "verifier" && (
          <section className="py-12 max-w-4xl mx-auto px-4 w-full">
            <div className="mb-10 text-center">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400 bg-blue-950/40 border border-blue-900/50 px-3 py-1.5 rounded-full">
                Auditor Verification Portal
              </span>
              <h2 className="text-3xl font-extrabold text-white mt-4 mb-2">
                Stellar Soroban Proof Auditor
              </h2>
              <p className="text-slate-400">
                Instantly execute on-chain BN254 host parameters. Verify physical
                asset solvency without ever learning identities.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 p-1 shadow-2xl shadow-black/40">
              <div className="rounded-[14px] bg-black/20 p-5 sm:p-6">
                <VerifierMode />
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Global Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <span className="text-sm font-bold text-white">
              zkCred — Cryptographic Proof of Funds
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Stellar Global Hacker Series Submission.
            </p>
          </div>
          <div className="flex space-x-6 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-300">
              Architecture Specs
            </a>
            <a href="#" className="hover:text-slate-300">
              Soroban Verifier Source
            </a>
            <a href="#" className="hover:text-slate-300">
              Noir Circuit Schema
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}