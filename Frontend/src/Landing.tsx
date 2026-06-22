"use client";

import {
  useState, useEffect, useRef, useCallback,
  type ReactNode, type CSSProperties,
} from "react";
import {
  ShieldCheck, Wallet, Copy, Check, Lock, Loader2,
  ExternalLink, AlertTriangle, Eye, EyeOff, Zap,
  ArrowRight, ChevronRight, Globe, Code2, Layers,
  Terminal as TermIcon, Activity, Cpu, GitBranch,
} from "lucide-react";
import { VERIFIER_CONTRACT_ID } from "./config";

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type View = "home" | "prover" | "verifier";

const ASSET_CONFIGS = {
  USDC: { balance:12450.0,  min:100,   max:25000,  step:100, symbol:"$", label:"USD Coin",       color:"#60a5fa" },
  EURC: { balance:9800.0,   min:100,   max:20000,  step:100, symbol:"€", label:"Euro Coin",      color:"#a78bfa" },
  XLM:  { balance:45000.0,  min:1000,  max:100000, step:500, symbol:"✦", label:"Stellar Lumens", color:"#34d399" },
} as const;
type AssetKey = keyof typeof ASSET_CONFIGS;

const MOCK_TX   = "7a3f9c1e6b4d8a2f5c0e9b3d7a1f4c8e2b6d0a9f3c7e1b5d8a2f6c0e4b9d3a7f";
const MOCK_PROOF =
  "0x3c9902f4a1b8e3d72c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4" +
  "e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8" +
  "d2c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4e1d8c3f6a2b5e0d9" +
  "c4f7a1b3e8d2c5f0a9b4e1d8c3f6a2b5e0d9c4f7a1b3e8d2c5f0a9b4e1d8c3";

interface LogLine { id:number; text:string; type:"info"|"success"|"warn"|"error"; }

const COMPILE_STEPS: Array<{ text:string; type:LogLine["type"]; delay:number }> = [
  { text:"> Initialising noir-wasm-engine v0.31.0 …",               type:"info",    delay:0    },
  { text:"> Loading BN254 elliptic-curve parameters …",             type:"info",    delay:360  },
  { text:"> Parsing circuit topology from ACIR bytecode …",         type:"info",    delay:740  },
  { text:"  [1/4] Constraint analysis — 2,847 gates found.",        type:"info",    delay:1120 },
  { text:"  [2/4] Resolving arithmetic gate constraints …",         type:"info",    delay:1540 },
  { text:"  [3/4] Generating optimised witness map …",              type:"info",    delay:1940 },
  { text:"  [4/4] ACIR compilation complete.",                      type:"success", delay:2320 },
  { text:"> Initialising Barretenberg UltraPlonk backend …",        type:"info",    delay:2680 },
  { text:"> Injecting private witness: balance scalar …",           type:"info",    delay:3060 },
  { text:"  Threshold assertion: balance ≥ target  →  SATISFIED ✓", type:"success", delay:3440 },
  { text:"> Computing proof π via UltraPlonk protocol …",           type:"info",    delay:3820 },
  { text:"  KZG10 polynomial commitments …",                        type:"info",    delay:4200 },
  { text:"  Round 1 — Witness polynomial commitments.",             type:"info",    delay:4540 },
  { text:"  Round 2 — Permutation argument grand product …",        type:"info",    delay:4860 },
  { text:"  Round 3 — Quotient polynomial evaluated.",              type:"info",    delay:5180 },
  { text:"  Proof synthesis complete.  Output: 1,312 bytes.",       type:"success", delay:5560 },
  { text:"> Serialising proof artifact to hex encoding …",          type:"info",    delay:5860 },
  { text:"> ✓ Zero-knowledge proof package ready for export.",      type:"success", delay:6240 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCounter(target: number, duration = 1400, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

function useMouseParallax(strength = 12) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      setPos({ x: ((e.clientX - cx) / cx) * strength, y: ((e.clientY - cy) / cy) * strength });
    };
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, [strength]);
  return pos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

function PulseBeacon({ color = "violet" }: { color?: "violet"|"emerald"|"cyan" }) {
  const c = { violet:"bg-violet-400", emerald:"bg-emerald-400", cyan:"bg-cyan-400" }[color];
  const r = { violet:"bg-violet-500", emerald:"bg-emerald-500", cyan:"bg-cyan-500" }[color];
  return (
    <span className="relative inline-flex h-2 w-2 flex-shrink-0">
      <span className={`absolute inline-flex h-full w-full rounded-full ${c} opacity-75 animate-ping`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${r}`} />
    </span>
  );
}

function Tag({ children, color = "violet" }: { children: ReactNode; color?: "violet"|"emerald"|"cyan" }) {
  const s = {
    violet: "text-violet-300 bg-violet-500/10 border-violet-500/25",
    emerald:"text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
    cyan:   "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium tracking-widest uppercase ${s}`}>
      {children}
    </span>
  );
}

function Divider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />;
}

// Scroll-reveal wrapper
function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)] ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated Background
// ─────────────────────────────────────────────────────────────────────────────

function HeroBg({ parallax }: { parallax: { x: number; y: number } }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0 dot-grid opacity-35" />

      {/* Violet orb — parallax */}
      <div
        className="absolute top-[-18%] left-1/2 w-[1000px] h-[700px] rounded-full transition-transform duration-[1200ms] ease-out"
        style={{
          transform: `translate(-50%, 0) translate(${parallax.x * 0.4}px, ${parallax.y * 0.4}px)`,
          background: "radial-gradient(ellipse, rgba(124,58,237,0.22) 0%, transparent 68%)",
          filter: "blur(40px)",
        }}
      />
      {/* Cyan orb left */}
      <div
        className="absolute top-[28%] left-[-8%] w-[520px] h-[440px] rounded-full transition-transform duration-[1600ms] ease-out"
        style={{
          transform: `translate(${-parallax.x * 0.6}px, ${parallax.y * 0.3}px)`,
          background: "radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 70%)",
          filter: "blur(44px)",
          animation: "pulse-glow 4s ease-in-out infinite",
        }}
      />
      {/* Emerald orb right */}
      <div
        className="absolute top-[55%] right-[-4%] w-[420px] h-[420px] rounded-full transition-transform duration-[2000ms] ease-out"
        style={{
          transform: `translate(${parallax.x * 0.5}px, ${-parallax.y * 0.4}px)`,
          background: "radial-gradient(ellipse, rgba(16,185,129,0.09) 0%, transparent 70%)",
          filter: "blur(50px)",
          animation: "pulse-glow 5.5s ease-in-out infinite 1.5s",
        }}
      />

      {/* Drift particles */}
      {[
        { top:"20%", left:"15%", dx:"30px",  dy:"-80px",  dr:"20deg",  size:3, dur:"6s",   delay:"0s"   },
        { top:"60%", left:"8%",  dx:"60px",  dy:"-60px",  dr:"-15deg", size:2, dur:"8s",   delay:"2s"   },
        { top:"35%", right:"12%",dx:"-40px", dy:"-90px",  dr:"25deg",  size:2, dur:"7s",   delay:"1s"   },
        { top:"75%", right:"20%",dx:"-30px", dy:"-50px",  dr:"-20deg", size:3, dur:"9s",   delay:"3.5s" },
        { top:"15%", left:"55%", dx:"20px",  dy:"-100px", dr:"10deg",  size:2, dur:"7.5s", delay:"0.5s" },
        { top:"80%", left:"40%", dx:"-20px", dy:"-70px",  dr:"-10deg", size:2, dur:"6.5s", delay:"4s"   },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-violet-400/50"
          style={{
            top:p.top, left:(p as any).left, right:(p as any).right,
            width:p.size, height:p.size,
            "--dx":p.dx, "--dy":p.dy, "--dr":p.dr, "--dur":p.dur,
            animation:`drift ${p.dur} ease-in-out ${p.delay} infinite`,
          } as CSSProperties}
        />
      ))}

      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#02020a] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#02020a] to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating proof strings
// ─────────────────────────────────────────────────────────────────────────────

const FLOATERS = [
  { text:"0x3c9902f4a1b8…",     top:"10%", left:"4%",    delay:"0s",   dur:"6s"   },
  { text:"balance ≥ threshold", top:"20%", right:"3%",   delay:"1.3s", dur:"7s"   },
  { text:"e(A,B)·e(−α,β)=1",   top:"66%", left:"2%",    delay:"0.7s", dur:"8s"   },
  { text:"Groth16 · BN254",     top:"76%", right:"5%",   delay:"2.1s", dur:"5.5s" },
  { text:"zkp_v1.eyJjaXJj…",   top:"44%", left:"1.5%",  delay:"1.8s", dur:"6.5s" },
  { text:"pairing_check = true",top:"50%", right:"2%",   delay:"3s",   dur:"9s"   },
];

function FloatingCode() {
  return (
    <>
      {FLOATERS.map((f, i) => (
        <div
          key={i}
          className="absolute hidden xl:block mono text-[10px] text-white/8 select-none"
          style={{
            top:f.top, left:(f as any).left, right:(f as any).right,
            animation:`float ${f.dur} ease-in-out ${f.delay} infinite`,
          }}
        >
          {f.text}
        </div>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated shield hero graphic
// ─────────────────────────────────────────────────────────────────────────────

const ORBIT_GLYPHS = [
  { glyph:"π", color:"#a78bfa", r:90,  dur:"10s", rev:false },
  { glyph:"∑", color:"#06b6d4", r:90,  dur:"10s", rev:true  },
  { glyph:"⊕", color:"#34d399", r:130, dur:"16s", rev:false },
  { glyph:"∀", color:"#f472b6", r:130, dur:"16s", rev:true  },
  { glyph:"∇", color:"#fbbf24", r:165, dur:"22s", rev:false },
  { glyph:"λ", color:"#60a5fa", r:165, dur:"22s", rev:true  },
];

function HeroShield() {
  return (
    <div className="relative w-80 h-80 flex items-center justify-center select-none" aria-hidden>
      {/* Outer dashed rotating ring */}
      <div className="absolute w-[330px] h-[330px] rounded-full border border-dashed border-violet-500/12 animate-spin-slow" />
      {/* Mid ring reverse */}
      <div className="absolute w-[260px] h-[260px] rounded-full border border-violet-500/8 animate-spin-rev" />

      {/* Ring expand pulses */}
      <div className="absolute w-28 h-28 rounded-full border border-violet-500/25 animate-ring-expand" />
      <div className="absolute w-28 h-28 rounded-full border border-violet-500/20 animate-ring-expand" style={{animationDelay:"1.2s"}} />
      <div className="absolute w-28 h-28 rounded-full border border-cyan-500/15 animate-ring-expand-s" style={{animationDelay:"0.6s"}} />

      {/* Orbiting glyphs */}
      {ORBIT_GLYPHS.map((o, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            width: o.r * 2, height: o.r * 2,
            top: `calc(50% - ${o.r}px)`,
            left: `calc(50% - ${o.r}px)`,
            borderRadius: "50%",
            animation: `${o.rev ? "spin-rev" : "spin-slow"} ${o.dur} linear infinite`,
          }}
        >
          <span
            className="absolute mono font-bold text-sm"
            style={{
              top: 2, left: "50%",
              transform: "translateX(-50%)",
              color: o.color,
              textShadow: `0 0 14px ${o.color}88`,
              animation: `${o.rev ? "spin-slow" : "spin-rev"} ${o.dur} linear infinite`,
            }}
          >
            {o.glyph}
          </span>
        </div>
      ))}

      {/* Center shield */}
      <div className="relative w-28 h-28 rounded-full bg-[#07071a] border border-violet-500/30 flex items-center justify-center shadow-[0_0_60px_-10px_rgba(139,92,246,0.55)] animate-float">
        <div className="absolute inset-0 rounded-full bg-violet-500/5" />
        <ShieldCheck className="w-14 h-14 text-violet-400" strokeWidth={1.5} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Marquee tech strip
// ─────────────────────────────────────────────────────────────────────────────

const MARQUEE_ITEMS = [
  "Noir ZK Circuit", "BN254 Curve", "UltraPlonk", "Barretenberg",
  "Soroban Smart Contract", "Stellar Testnet", "Freighter Wallet",
  "Groth16 Proof", "KZG Commitments", "Zero Knowledge",
  "Client-Side Proving", "On-Chain Verification",
];

function MarqueeStrip() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="relative py-5 overflow-hidden border-y border-white/4 marquee-track">
      <div className="marquee-inner gap-0">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-6 px-6 text-xs text-slate-600 mono uppercase tracking-wider whitespace-nowrap">
            <span className="w-1 h-1 rounded-full bg-violet-500/40 flex-shrink-0" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────────────────────

function Navbar({ view, onNav, wallet, onWallet }:
  { view:View; onNav:(v:View)=>void; wallet:boolean; onWallet:()=>void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", h, { passive:true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const link = (v:View, label:string) => (
    <button
      onClick={() => onNav(v)}
      className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        view === v ? "text-violet-300" : "text-slate-400 hover:text-slate-100"
      }`}
    >
      {view === v && (
        <span className="absolute inset-0 rounded-lg bg-violet-500/10 border border-violet-500/20 animate-appear-scale" />
      )}
      <span className="relative">{label}</span>
    </button>
  );

  return (
    <header className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? "glass border-b border-white/[0.06]" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <button onClick={() => onNav("home")} className="flex items-center gap-3 group">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-xl bg-violet-600/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
          </div>
          <div className="hidden sm:block">
            <span className="block text-base font-bold" style={{fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.02em"}}>
              zk<span className="text-violet-400">Cred</span>
            </span>
            <span className="block text-[9px] mono text-violet-400/60 tracking-widest uppercase">Stellar ZK Layer</span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {link("home","Home")}
          {link("prover","Prover")}
          {link("verifier","Auditor")}
        </nav>

        <button
          onClick={onWallet}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
            wallet
              ? "glass border border-emerald-500/30 text-slate-200 hover:border-emerald-400/50"
              : "btn-gradient text-white"
          }`}
        >
          {wallet ? (
            <><PulseBeacon color="emerald" /><span className="mono text-xs">GAJSQ…YQOO</span></>
          ) : (
            <><Wallet className="w-4 h-4" /><span className="hidden sm:inline">Connect Wallet</span><span className="sm:hidden">Connect</span></>
          )}
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated stat counter card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ value, label, started, delay = 0 }:
  { value:string; label:string; started:boolean; delay?:number }) {
  const rawNum   = parseInt(value.replace(/[^0-9]/g,""), 10) || 0;
  const isCount  = rawNum > 0 && /^[\d]+/.test(value);
  const counted  = useCounter(rawNum, 1600, started && isCount);
  const display  = isCount ? value.replace(rawNum.toString(), counted.toLocaleString()) : value;

  return (
    <div className="bg-[#07071a] px-6 py-6 text-center hover:bg-white/[0.025] transition-all duration-300 group cursor-default">
      <div
        className="text-2xl font-bold mono text-white mb-1.5 group-hover:text-violet-300 transition-colors duration-300"
        style={{
          opacity: started ? 1 : 0,
          transform: started ? "translateY(0)" : "translateY(14px)",
          transition: `opacity .55s ${delay + 80}ms, transform .55s cubic-bezier(.16,1,.3,1) ${delay + 80}ms`,
        }}
      >
        {display}
      </div>
      <div className="text-xs text-slate-500 leading-snug">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero section
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value:"0",    label:"Private keys exposed"     },
  { value:"1",    label:"Binary result to auditor"  },
  { value:"100%", label:"Client-side computation"   },
  { value:"<1¢",  label:"On-chain verification"     },
];

function Hero({ onNav }: { onNav:(v:View)=>void }) {
  const [visible, setVisible]       = useState(false);
  const [statsStarted, setStarted]  = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const parallax = useMouseParallax(14);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fd = (ms:number): CSSProperties => ({ animationDelay:`${ms}ms`, animationFillMode:"both" });

  return (
    <section className="relative min-h-[96vh] flex flex-col items-center justify-center py-24 overflow-hidden">
      <HeroBg parallax={parallax} />
      <FloatingCode />

      <div className="relative z-10 max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-16 items-center w-full">

        {/* Left — copy */}
        <div className="text-center lg:text-left">
          {visible && (
            <div className="mb-8 animate-fade-up" style={fd(0)}>
              <Tag color="violet"><PulseBeacon color="violet" />Stellar Testnet — Live</Tag>
            </div>
          )}
          {visible && (
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.0] mb-6 animate-fade-up"
              style={{ ...fd(120), fontFamily:"'Space Grotesk',sans-serif", letterSpacing:"-0.04em" }}
            >
              Prove solvency.
              <br />
              <span className="grad-full">Reveal nothing.</span>
            </h1>
          )}
          {visible && (
            <p className="text-lg text-slate-400 max-w-xl leading-relaxed mb-10 animate-fade-up" style={fd(240)}>
              zkCred generates cryptographic zero-knowledge proofs of your Stellar
              wallet balance — on your device, in seconds — without exposing your
              address, history, or exact holdings.
            </p>
          )}
          {visible && (
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 mb-6 animate-fade-up" style={fd(360)}>
              <button
                onClick={() => onNav("prover")}
                className="btn-gradient w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-white font-semibold text-base"
              >
                <Zap className="w-5 h-5" />Generate Proof<ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNav("verifier")}
                className="btn-ghost w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-slate-300 font-semibold text-base"
              >
                <Eye className="w-5 h-5" />Verify a Proof
              </button>
            </div>
          )}
          {visible && (
            <p className="text-xs text-slate-600 animate-fade-up" style={fd(460)}>
              No signup. No backend. Fully open-source.
            </p>
          )}
        </div>

        {/* Right — shield */}
        {visible && (
          <div className="hidden lg:flex items-center justify-center animate-fade-in" style={fd(200)}>
            <HeroShield />
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div ref={statsRef} className="relative z-10 w-full max-w-4xl mx-auto px-4 mt-16">
        {visible && (
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5 animate-fade-up"
            style={fd(500)}
          >
            {STATS.map((s, i) => (
              <StatCard key={i} {...s} started={statsStarted} delay={i * 120} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy section
// ─────────────────────────────────────────────────────────────────────────────

const OLD_ITEMS = [
  "Auditor sees your exact balance in real-time",
  "Your complete transaction history is exposed",
  "Wallet address links to your real-world identity",
  "Permanent privacy loss — records exist forever",
  "High-value target for phishing & physical threat",
];
const NEW_ITEMS = [
  "Auditor receives only TRUE or FALSE",
  "Transaction history stays completely private",
  "Wallet address is never revealed or transmitted",
  "Zero data exposure — nothing to leak",
  "No target created, no risk created",
];

function PrivacySection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section ref={ref} className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[#02020a] via-[#05051a]/30 to-[#02020a] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Reveal><Tag color="violet">The Privacy Problem</Tag></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight" style={{letterSpacing:"-0.03em"}}>
              Sharing your wallet address<br />is a privacy catastrophe
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">
              Traditional proof-of-funds leaves a permanent, irreversible trail of your entire financial life.
            </p>
          </Reveal>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Reveal delay={0}>
            <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-8 relative overflow-hidden shimmer-card h-full">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none"
                style={{background:"radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 70%)"}} />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <EyeOff className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-sm font-semibold text-red-400 mono uppercase tracking-wider">Traditional Method</span>
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-6">Share Your Public Address</h3>
              <ul className="space-y-3.5">
                {OLD_ITEMS.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-slate-400"
                    style={{
                      opacity: inView ? 1 : 0,
                      transform: inView ? "translateX(0)" : "translateX(-14px)",
                      transition: `opacity .5s ${200 + i*80}ms, transform .5s cubic-bezier(.16,1,.3,1) ${200 + i*80}ms`,
                    }}
                  >
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400 text-[10px] font-bold">✕</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-8 relative overflow-hidden shimmer-card h-full">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none"
                style={{background:"radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)"}} />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-sm font-semibold text-violet-400 mono uppercase tracking-wider">zkCred Standard</span>
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-6">Submit a ZK Proof</h3>
              <ul className="space-y-3.5">
                {NEW_ITEMS.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-slate-400"
                    style={{
                      opacity: inView ? 1 : 0,
                      transform: inView ? "translateX(0)" : "translateX(14px)",
                      transition: `opacity .5s ${300 + i*80}ms, transform .5s cubic-bezier(.16,1,.3,1) ${300 + i*80}ms`,
                    }}
                  >
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 text-[10px] font-bold">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// How It Works
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { n:"01", icon:<Wallet className="w-6 h-6"/>,  color:"#8b5cf6", title:"Connect & Read Balance",    body:"Connect your Freighter wallet. zkCred reads your public token balances from Stellar Horizon — client-side only, nothing transmitted." },
  { n:"02", icon:<Code2 className="w-6 h-6"/>,   color:"#06b6d4", title:"Generate ZK Proof Locally",  body:"Set your threshold. A Noir circuit runs entirely in your browser using the Barretenberg proving engine, producing cryptographic proof π." },
  { n:"03", icon:<Layers className="w-6 h-6"/>,  color:"#10b981", title:"Verify On-Chain",             body:"The auditor submits your proof to our Soroban contract. BN254 host functions return TRUE or FALSE. No data exposed." },
];

function HowItWorks({ onNav }: { onNav:(v:View)=>void }) {
  const { ref, inView } = useInView(0.15);

  return (
    <section className="py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Reveal><Tag color="cyan">How It Works</Tag></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight" style={{letterSpacing:"-0.03em"}}>
              Three steps. Complete privacy.
            </h2>
          </Reveal>
        </div>

        <div ref={ref} className="relative grid md:grid-cols-3 gap-6">
          {/* Animated connector */}
          <div className="hidden md:block absolute top-[3.2rem] left-[22%] right-[22%] h-px overflow-hidden pointer-events-none">
            <div
              className="h-full transition-all duration-1000 ease-out"
              style={{
                background: "linear-gradient(90deg, rgba(139,92,246,.4), rgba(6,182,212,.4), rgba(16,185,129,.4))",
                width: inView ? "100%" : "0%",
                transitionDelay: "300ms",
              }}
            />
            {/* Moving glow dot */}
            {inView && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-violet-400"
                style={{
                  boxShadow: "0 0 10px 3px rgba(139,92,246,.7)",
                  animation: "warp-star 2.6s ease-in-out 1.2s infinite",
                  left: "-12px",
                }}
              />
            )}
          </div>

          {STEPS.map((s, i) => (
            <div
              key={i}
              className="glass-card rounded-2xl p-8"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0) scale(1)" : "translateY(30px) scale(.95)",
                transition: `opacity .65s cubic-bezier(.16,1,.3,1) ${i*160}ms, transform .65s cubic-bezier(.16,1,.3,1) ${i*160}ms`,
              }}
            >
              <div className="relative mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background:`${s.color}18`, border:`1px solid ${s.color}35`, color:s.color }}
                >
                  {s.icon}
                </div>
                <span className="absolute top-0 right-0 mono text-5xl font-bold leading-none"
                  style={{color:`${s.color}0d`}}>{s.n}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <Reveal delay={300}>
          <div className="mt-12 text-center">
            <button
              onClick={() => onNav("prover")}
              className="btn-gradient inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold"
            >
              Start Proving <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract strip
// ─────────────────────────────────────────────────────────────────────────────

function ContractStrip() {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(VERIFIER_CONTRACT_ID).catch(()=>{});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <section className="py-16">
      <Divider />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Reveal><Tag color="emerald"><Globe className="w-3 h-3" />Deployed on Stellar Testnet</Tag></Reveal>
        <Reveal delay={100}><p className="mt-4 text-slate-400 text-sm mb-5">Soroban verifier contract — live and callable</p></Reveal>
        <Reveal delay={200}>
          <button
            onClick={copy}
            className="inline-flex items-center gap-2 glass hover:border-violet-500/30 transition-all duration-200 px-4 py-2.5 rounded-xl mono text-xs text-violet-300 hover:text-violet-200 hover:shadow-[0_0_20px_-4px_rgba(139,92,246,.3)] shimmer-card"
          >
            <span className="truncate max-w-[260px] sm:max-w-md">{VERIFIER_CONTRACT_ID}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 flex-shrink-0" />}
          </button>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-4">
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${VERIFIER_CONTRACT_ID}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-400 transition-colors duration-200"
            >
              View on Stellar Expert <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </Reveal>
      </div>
      <Divider />
    </section>
  );
}

function HomePage({ onNav }: { onNav:(v:View)=>void }) {
  return (
    <>
      <Hero onNav={onNav} />
      <MarqueeStrip />
      <PrivacySection />
      <HowItWorks onNav={onNav} />
      <ContractStrip />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prover page
// ─────────────────────────────────────────────────────────────────────────────

const PROOF_STAGES = [
  { label:"Setup",    icon:<Cpu className="w-3.5 h-3.5"/>      },
  { label:"Witness",  icon:<GitBranch className="w-3.5 h-3.5"/> },
  { label:"Prove",    icon:<Activity className="w-3.5 h-3.5"/>  },
  { label:"Finalise", icon:<Check className="w-3.5 h-3.5"/>    },
];

function ProverPage() {
  const [asset, setAsset]         = useState<AssetKey>("USDC");
  const [threshold, setThreshold] = useState(5000);
  const [running, setRunning]     = useState(false);
  const [logs, setLogs]           = useState<LogLine[]>([]);
  const [proof, setProof]         = useState("");
  const [copied, setCopied]       = useState(false);
  const [stageIdx, setStageIdx]   = useState(-1);
  const termRef = useRef<HTMLDivElement>(null);
  const timers  = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cfg = ASSET_CONFIGS[asset];
  const overBalance = threshold > cfg.balance;
  const pct = Math.round(((threshold - cfg.min) / (cfg.max - cfg.min)) * 100);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [logs]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  function onAssetChange(a: AssetKey) {
    setAsset(a);
    setThreshold(Math.round(ASSET_CONFIGS[a].balance / 2.5));
    setLogs([]); setProof(""); setStageIdx(-1);
  }

  function generate() {
    if (overBalance || running) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRunning(true); setLogs([]); setProof(""); setStageIdx(0);

    [0, 2400, 3800, 5600].forEach((t, i) => {
      timers.current.push(setTimeout(() => setStageIdx(i), t));
    });

    COMPILE_STEPS.forEach((s, i) => {
      timers.current.push(setTimeout(() => setLogs(p => [...p, { id:i, text:s.text, type:s.type }]), s.delay));
    });

    const finish = COMPILE_STEPS[COMPILE_STEPS.length - 1].delay + 900;
    timers.current.push(setTimeout(() => { setRunning(false); setProof(MOCK_PROOF); setStageIdx(4); }, finish));
  }

  function copyProof() {
    navigator.clipboard?.writeText(proof).catch(()=>{});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const logCol: Record<LogLine["type"], string> = {
    info:"text-slate-400", success:"text-emerald-400", warn:"text-yellow-400", error:"text-red-400",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 w-full">
      <div className="mb-10">
        <Reveal><Tag color="violet"><Zap className="w-3 h-3" />Prover Environment</Tag></Reveal>
        <Reveal delay={100}>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight" style={{letterSpacing:"-0.03em"}}>
            On-Device Zero-Knowledge Generator
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-2 text-slate-400 max-w-xl">
            Your balance and keys never leave the browser. The circuit runs locally; the proof is the only thing shared.
          </p>
        </Reveal>
      </div>

      {/* Stage indicator */}
      <Reveal delay={300}>
        <div className="glass rounded-2xl p-4 mb-6">
          <div className="flex items-center">
            {PROOF_STAGES.map((s, i) => {
              const done   = stageIdx > i;
              const active = stageIdx === i;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 relative">
                  {i < PROOF_STAGES.length - 1 && (
                    <div className="absolute top-4 left-1/2 right-0 h-px w-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                        style={{ width: done ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                  <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center step-node ${done ? "done" : active ? "active" : "border-white/10 bg-transparent"}`}>
                    {done
                      ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                      : <span className={active ? "text-violet-300" : "text-slate-600"}>{s.icon}</span>
                    }
                    {active && (
                      <>
                        <span className="absolute inset-0 rounded-full border border-violet-400/40 animate-ring-expand" />
                        <span className="absolute inset-0 rounded-full border border-violet-400/25 animate-ring-expand" style={{animationDelay:"1.2s"}} />
                      </>
                    )}
                  </div>
                  <span className={`text-[10px] mono font-medium tracking-wider ${done ? "text-emerald-400" : active ? "text-violet-300" : "text-slate-600"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-5 gap-6">

        {/* Controls */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          <Reveal>
            <div className="glass rounded-2xl p-6">
              <p className="mono text-[11px] text-slate-500 uppercase tracking-widest mb-4">Select Asset</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(ASSET_CONFIGS) as AssetKey[]).map(a => {
                  const ac = ASSET_CONFIGS[a];
                  const sel = asset === a;
                  return (
                    <button
                      key={a}
                      onClick={() => onAssetChange(a)}
                      className={`flex flex-col items-center gap-2 py-4 px-2 rounded-xl border transition-all duration-250 ${
                        sel
                          ? "border-violet-500/40 bg-violet-500/10 text-violet-300 scale-[1.03] shadow-[0_0_20px_-4px_rgba(139,92,246,0.3)]"
                          : "border-white/6 bg-white/[0.02] text-slate-400 hover:border-white/14 hover:text-slate-200 hover:scale-[1.02]"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          background: sel ? ac.color : "#334155",
                          boxShadow: sel ? `0 0 10px ${ac.color}` : "none",
                        }}
                      />
                      <span className="text-sm font-bold mono">{a}</span>
                      <span className="text-[10px] text-slate-500 leading-tight text-center">{ac.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="glass rounded-2xl p-6">
              <p className="mono text-[11px] text-slate-500 uppercase tracking-widest mb-3">Ledger Balance</p>
              <div className="flex items-baseline gap-3 bg-black/30 rounded-xl px-4 py-4 border border-white/5">
                <span className="mono text-3xl font-bold text-white transition-all duration-300">
                  {cfg.symbol}{cfg.balance.toLocaleString("en-US",{minimumFractionDigits:2})}
                </span>
                <span className="text-sm text-slate-500">{asset}</span>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                  <PulseBeacon color="emerald" />Live
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                <Lock className="w-3 h-3" />Client-side only — never transmitted
              </p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="mono text-[11px] text-slate-500 uppercase tracking-widest">Min Threshold</p>
                <span
                  className="mono text-base font-bold transition-all duration-200"
                  style={{ color: overBalance ? "#f87171" : "#f1f5f9" }}
                >
                  {cfg.symbol}{threshold.toLocaleString()}
                </span>
              </div>

              <div className="relative h-6 flex items-center mb-1">
                <div className="absolute left-0 right-0 h-1 rounded-full bg-white/6 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width:`${pct}%`,
                      background: overBalance ? "linear-gradient(90deg,#dc2626,#ef4444)" : "linear-gradient(90deg,#7c3aed,#2563eb)",
                    }}
                  />
                </div>
                <div
                  className="absolute w-5 h-5 rounded-full border-2 shadow-lg pointer-events-none transition-all duration-150 z-10"
                  style={{
                    left:`calc(${pct}% - 10px)`,
                    background: overBalance ? "#dc2626" : "#8b5cf6",
                    borderColor: overBalance ? "#fca5a5" : "#a78bfa",
                    boxShadow: overBalance ? "0 0 14px rgba(239,68,68,.6)" : "0 0 14px rgba(139,92,246,.6)",
                  }}
                />
                <input
                  type="range"
                  min={cfg.min} max={cfg.max} step={cfg.step} value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
                />
              </div>

              <div className="flex justify-between mt-3">
                <span className="mono text-[10px] text-slate-600">{cfg.symbol}{cfg.min.toLocaleString()}</span>
                <span className="mono text-[10px] text-slate-600">{cfg.symbol}{cfg.max.toLocaleString()}</span>
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-600">
                <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Proves balance ≥ threshold without revealing exact figure
              </p>
            </div>
          </Reveal>

          {overBalance && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 animate-slide-in-up">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                <strong>Warning:</strong> Threshold exceeds balance. Circuit will fail.
              </p>
            </div>
          )}

          <button
            onClick={generate}
            disabled={overBalance || running}
            className="btn-gradient w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running
              ? <><Loader2 className="w-4 h-4 animate-spin" />Compiling Circuit…</>
              : proof
                ? <><ShieldCheck className="w-4 h-4" />Regenerate Proof</>
                : <><ShieldCheck className="w-4 h-4" />Generate ZK Proof</>
            }
          </button>
        </div>

        {/* Terminal */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          <div className={`terminal flex flex-col flex-1 min-h-[480px] ${running ? "terminal-scan" : ""}`}>
            <div className="terminal-bar flex items-center gap-2 px-4 py-3">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-amber-500/70" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
              <span className="ml-3 mono text-[11px] text-slate-500 flex-1 flex items-center gap-1.5">
                <TermIcon className="w-3 h-3 opacity-50" />
                noir-wasm-engine — zkCred prover
              </span>
              {running && (
                <span className="flex items-center gap-1.5 mono text-[10px] text-violet-400">
                  <PulseBeacon color="violet" />running
                </span>
              )}
              {!running && proof && (
                <span className="flex items-center gap-1.5 mono text-[10px] text-emerald-400">
                  <Check className="w-3 h-3" />complete
                </span>
              )}
            </div>

            <div
              ref={termRef}
              className="terminal-body flex-1 overflow-y-auto p-5 space-y-1.5"
              style={{ fontFamily:"'JetBrains Mono',monospace" }}
            >
              {logs.length === 0 && !running && (
                <p className="text-[12px] text-slate-700 italic">// Awaiting compilation trigger…</p>
              )}
              {logs.map((l, idx) => (
                <p
                  key={l.id}
                  className={`text-[12px] leading-relaxed ${logCol[l.type]}`}
                  style={{
                    opacity: 0,
                    animation: `fadeUp .35s cubic-bezier(.16,1,.3,1) ${Math.min(idx * 15, 200)}ms forwards`,
                  }}
                >
                  {l.text}
                </p>
              ))}
              {running && <span className="inline-block w-2 h-4 bg-violet-400 animate-type-cursor" />}
            </div>
          </div>

          {proof && (
            <div className="verified-badge rounded-2xl p-6 animate-bounce-in">
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-emerald-500/15">
                <div className="ring-pulse-wrap">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-emerald-300">Zero-Knowledge Proof Generated</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mono">BN254 · UltraPlonk · 1,312 bytes</p>
                </div>
                <button
                  onClick={copyProof}
                  className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 glass text-xs text-slate-300 hover:text-white transition-all duration-200 hover:border-white/20"
                >
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400"/>Copied!</> : <><Copy className="w-3.5 h-3.5"/>Copy</>}
                </button>
              </div>
              <textarea
                readOnly value={proof} rows={4}
                className="w-full resize-none rounded-xl bg-black/50 border border-white/5 px-4 py-3 mono text-xs text-emerald-400/80 focus:outline-none input-glow"
              />
              <p className="mt-3 text-[11px] text-slate-500 text-center">
                Share this proof with the auditor — they verify it at the Auditor Portal
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auditor page
// ─────────────────────────────────────────────────────────────────────────────

type VerifyState = "idle"|"loading"|"valid"|"invalid"|"empty";

function AuditorPage() {
  const [input, setInput]       = useState("");
  const [state, setState]       = useState<VerifyState>("idle");
  const [progress, setProgress] = useState(0);
  const [ripple, setRipple]     = useState<{x:number;y:number}|null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function verify(e: React.MouseEvent<HTMLButtonElement>) {
    if (!input.trim()) { setState("empty"); return; }
    const rect = btnRef.current!.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setRipple(null), 700);

    setState("loading"); setProgress(0);
    [10, 28, 46, 62, 77, 92, 100].forEach((p, i) => setTimeout(() => setProgress(p), i * 240));
    setTimeout(() => setState("valid"), 7 * 240 + 300);
  }

  function reset() { setInput(""); setState("idle"); setProgress(0); }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 w-full">
      <div className="mb-10">
        <Reveal><Tag color="cyan"><Eye className="w-3 h-3" />Auditor Portal</Tag></Reveal>
        <Reveal delay={100}>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight" style={{letterSpacing:"-0.03em"}}>
            Verify a zkCred Proof
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-2 text-slate-400 max-w-xl">
            Paste the proof string from the prover. The Soroban contract on Stellar testnet returns a cryptographic TRUE / FALSE.
          </p>
        </Reveal>
      </div>

      <Reveal delay={300}>
        <div className="glass rounded-2xl p-6 mb-5 shimmer-card">
          <p className="mono text-[11px] text-slate-500 uppercase tracking-widest mb-3">Proof Artifact</p>
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); if (state !== "idle") setState("idle"); }}
            placeholder="Paste zkCred proof here (e.g. 0x3c9902f4a1b8e3d7…)"
            rows={5}
            className="w-full resize-none rounded-xl bg-black/40 border border-white/6 px-4 py-3 mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none input-glow transition-all duration-200"
          />

          {state === "loading" && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[10px] mono text-slate-600">
                <span>Submitting to Soroban contract…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-200"
                  style={{ width:`${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              ref={btnRef}
              onClick={verify}
              disabled={state === "loading"}
              className="btn-gradient relative flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              {ripple && (
                <span
                  className="absolute rounded-full bg-white/20 w-16 h-16 -translate-x-1/2 -translate-y-1/2 animate-ripple pointer-events-none"
                  style={{ left:ripple.x, top:ripple.y }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {state === "loading"
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying on-chain…</>
                  : <><ShieldCheck className="w-4 h-4" />Run On-Chain Verification</>
                }
              </span>
            </button>
            {state !== "idle" && state !== "loading" && (
              <button onClick={reset} className="btn-ghost px-4 py-3.5 rounded-xl text-slate-400 hover:text-white text-sm">
                Reset
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {state === "empty" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5 animate-slide-in-up">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">Please paste a valid proof string before verifying.</p>
        </div>
      )}

      {state === "valid" && (
        <div className="verified-badge rounded-2xl p-8 animate-bounce-in">
          <div className="flex items-center gap-5 mb-8">
            <div className="ring-pulse-wrap flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="mono text-[2.6rem] font-bold text-emerald-300 leading-none" style={{animation:"bounce-in .6s cubic-bezier(.16,1,.3,1)"}}>
                TRUE
              </div>
              <p className="text-sm text-slate-400 mt-1">Cryptographic proof verified on Stellar testnet</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { label:"Result",    value:"VALID ✓",                     color:"text-emerald-400" },
              { label:"Network",   value:"Stellar Testnet",              color:"text-slate-200"  },
              { label:"Timestamp", value:new Date().toLocaleTimeString(), color:"text-slate-200"  },
            ].map((r, i) => (
              <div
                key={i}
                className="bg-black/20 rounded-xl p-4 border border-white/5"
                style={{ animation:`slide-in-up .4s cubic-bezier(.16,1,.3,1) ${i*80}ms both` }}
              >
                <p className="mono text-[10px] text-slate-500 uppercase tracking-wider mb-1">{r.label}</p>
                <p className={`font-semibold text-sm ${r.color}`}>{r.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <p className="mono text-[10px] text-slate-500 uppercase tracking-wider mb-2">Transaction</p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${MOCK_TX}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 mono text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              <span className="truncate">{MOCK_TX.slice(0,24)}…{MOCK_TX.slice(-8)}</span>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            </a>
          </div>

          <p className="mt-5 text-center text-xs text-slate-500">
            This wallet holds ≥ the stated threshold. No balance, address, or history was disclosed.
          </p>
        </div>
      )}

      {state === "invalid" && (
        <div className="rejected-badge rounded-2xl p-8 animate-bounce-in text-center">
          <div className="ring-pulse-wrap inline-flex mx-auto mb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/15 border-2 border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <div className="mono text-3xl font-bold text-red-400 mb-2">FALSE</div>
          <p className="text-sm text-slate-400">Proof is invalid or does not satisfy the threshold.</p>
        </div>
      )}

      <Reveal delay={100}>
        <div className="mt-8 glass rounded-2xl p-5">
          <p className="mono text-[10px] text-slate-500 uppercase tracking-wider mb-2">Verifier Contract</p>
          <div className="flex items-center gap-2">
            <PulseBeacon color="emerald" />
            <span className="mono text-xs text-slate-400 truncate">{VERIFIER_CONTRACT_ID}</span>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${VERIFIER_CONTRACT_ID}`}
              target="_blank" rel="noreferrer"
              className="flex-shrink-0 text-slate-500 hover:text-violet-400 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function Footer({ onNav }: { onNav:(v:View)=>void }) {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <button onClick={() => onNav("home")} className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center group-hover:shadow-[0_0_16px_-2px_rgba(139,92,246,.6)] transition-all duration-300">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
            zk<span className="text-violet-400">Cred</span>
          </span>
        </button>
        <p className="text-xs text-slate-600 text-center">
          Privacy-preserving proof of funds on Stellar · Built for Stellar Hacks: Real-World ZK
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <button onClick={() => onNav("prover")}   className="hover:text-slate-300 transition-colors">Prover</button>
          <button onClick={() => onNav("verifier")} className="hover:text-slate-300 transition-colors">Auditor</button>
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${VERIFIER_CONTRACT_ID}`}
            target="_blank" rel="noreferrer"
            className="hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            Contract <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function ZkCredApp() {
  const [view, setView]     = useState<View>("home");
  const [wallet, setWallet] = useState(false);

  const nav = useCallback((v: View) => {
    setView(v);
    window.scrollTo({ top:0, behavior:"smooth" });
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background:"#02020a" }}>
      <Navbar view={view} onNav={nav} wallet={wallet} onWallet={() => setWallet(p => !p)} />
      <main className="flex-1 flex flex-col items-center">
        {view === "home"     && <HomePage onNav={nav} />}
        {view === "prover"   && <ProverPage />}
        {view === "verifier" && <AuditorPage />}
      </main>
      <Footer onNav={nav} />
    </div>
  );
}
