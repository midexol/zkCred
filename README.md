# zkCred — Privacy-Preserving Proof of Funds on Stellar

> **Stellar Hacks: Real-World ZK** — Track: Real-World Use Cases, Compliance & Identity

zkCred lets anyone cryptographically prove their wallet holds *at least* a minimum balance — without revealing their wallet address, exact balance, or transaction history. Auditors get a simple **TRUE / FALSE**. Everything else stays private.

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Solution](#2-the-solution)
3. [How It Works (User Flow)](#3-how-it-works-user-flow)
4. [Architecture](#4-architecture)
5. [Zero-Knowledge Circuit Explained](#5-zero-knowledge-circuit-explained)
6. [Soroban Smart Contract Explained](#6-soroban-smart-contract-explained)
7. [Technology Stack](#7-technology-stack)
8. [Project Structure](#8-project-structure)
9. [Setup & Installation](#9-setup--installation)
10. [Running the Full Demo](#10-running-the-full-demo)
11. [Why This Wins the Hackathon](#11-why-this-wins-the-hackathon)
12. [Team](#12-team)

---

## 1. The Problem

When a Web3 user needs to prove liquidity in the real world — to rent an apartment, get supplier credit, or satisfy a visa requirement — they face a binary, broken choice:

| They must show... | What the other party actually sees |
|---|---|
| Their public wallet address | Real-time balance of **every** token they hold |
| | **Complete** transaction history going back years |
| | **All** counterparties they have ever interacted with |
| | Enough information to target them for phishing or physical theft |

Sharing a wallet address is the Web3 equivalent of handing over your full bank statement, tax returns, and spending history — forever. **There is currently no privacy-respecting way to prove Stellar wallet solvency.**

---

## 2. The Solution

zkCred uses **Zero-Knowledge Proofs (ZKPs)** to let a user prove a mathematical claim — *"my balance is at least $5,000 USDC"* — without revealing any data beyond that one binary fact.

| Traditional Method | zkCred (Zero-Knowledge) |
|---|---|
| Hand over public wallet address | Wallet address stays completely private |
| Auditor sees exact balance ($54,231.50) | Auditor sees only `TRUE` (Balance ≥ $5,000) |
| Auditor sees all past transactions | Auditor sees zero history |
| High risk of targeted attacks | Zero risk of targeted attacks |
| Privacy destroyed permanently | Nothing is exposed, ever |

The proof is a short string of bytes. It can be emailed, pasted into a form, or embedded in a document. It carries zero identifying information. Verifying it on-chain costs a fraction of a cent.

---

## 3. How It Works (User Flow)

```
  PROVER (User)                          VERIFIER (Auditor / Landlord)
  ─────────────────────────────────      ──────────────────────────────────
  1. Connect Freighter wallet
  2. Enter threshold (e.g. $5,000)
  3. zkCred reads balance via               
     Stellar Horizon API                 
  4. Noir circuit runs LOCALLY:          
     circuit(balance=42318, 
             threshold=5000) → π         
  5. Receives proof string:              6. Receives proof string from user
     "zkp_v1.abc123..."         ──────▶  7. Pastes into zkCred Auditor Portal
                                         8. Portal calls Soroban contract:
                                            verify_proof(π, threshold, asset)
                                         9. Contract uses BN254 host functions
                                            to check the pairing equation
                                        10. Returns: TRUE ✅ or FALSE ❌
```

**Key guarantee:** Steps 3–4 happen entirely in the user's browser. The real balance is never sent to any server.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              zkCred System                                  │
│                                                                             │
│  ┌──────────────────────────┐        ┌──────────────────────────────────┐  │
│  │   ZONE B — Frontend       │        │   ZONE A — Backend               │  │
│  │   (Next.js / React)       │        │                                  │  │
│  │                           │        │  ┌──────────────────────────┐   │  │
│  │  ┌─────────────────────┐  │        │  │  Noir Circuit (main.nr)  │   │  │
│  │  │  Prover Dashboard   │  │        │  │                          │   │  │
│  │  │  ─────────────────  │  │        │  │  fn main(               │   │  │
│  │  │  1. Connect wallet  │  │        │  │    balance: u64,         │   │  │
│  │  │  2. Pick asset      │  │ calls  │  │    threshold: pub u64,   │   │  │
│  │  │  3. Set threshold   │──┼───────▶│  │    asset_id: pub Field,  │   │  │
│  │  │  4. Generate proof  │  │        │  │    nonce: pub Field,     │   │  │
│  │  │  5. Copy proof str  │  │        │  │  ) {                     │   │  │
│  │  └─────────────────────┘  │        │  │    assert(balance >=     │   │  │
│  │                           │        │  │           threshold);    │   │  │
│  │  ┌─────────────────────┐  │        │  │  }                       │   │  │
│  │  │  Auditor Portal     │  │        │  └──────────┬───────────────┘   │  │
│  │  │  ─────────────────  │  │        │             │ compiles to        │  │
│  │  │  1. Paste proof     │  │        │             ▼                    │  │
│  │  │  2. Click Verify    │  │        │  ┌──────────────────────────┐   │  │
│  │  │  3. See TRUE/FALSE  │  │        │  │  Groth16 Verifier WASM   │   │  │
│  │  └──────────┬──────────┘  │        │  │  (Rust / Soroban)        │   │  │
│  │             │             │        │  │                          │   │  │
│  │             │ invokes     │        │  │  verify_proof(π, inputs) │   │  │
│  └─────────────┼─────────────┘        │  │    → BN254 pairing check │   │  │
│                │                      │  │    → true / false        │   │  │
│                │                      │  └──────────────────────────┘   │  │
│                │                      └──────────────────────────────────┘  │
│                │                                      │                     │
│                │              deploys to              │                     │
│                └─────────────────────────────────────▼──────────────────┐  │
│                                                                          │  │
│                          STELLAR TESTNET                                 │  │
│                  ┌───────────────────────────────┐                      │  │
│                  │  Soroban Smart Contract        │                      │  │
│                  │  (ZkCredVerifier)              │                      │  │
│                  │                               │                      │  │
│                  │  Storage:                     │                      │  │
│                  │    VerificationKey (instance)  │                      │  │
│                  │    UsedNonces (temporary)      │                      │  │
│                  │                               │                      │  │
│                  │  BN254 host functions:         │                      │  │
│                  │    bn254_g1_mul()              │                      │  │
│                  │    bn254_g1_add()              │                      │  │
│                  │    bn254_pairing_check()       │                      │  │
│                  └───────────────────────────────┘                      │  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Zero-Knowledge Circuit Explained

The circuit lives in `Backend/circuits/src/main.nr`. Here is what it does, in plain English:

### What is a ZK Circuit?

Think of it like a **locked box with a window**. The prover puts their secret (the balance) inside the box, locks it, and the box performs a calculation. Through the window, the verifier can see the *result* of the calculation (TRUE/FALSE) but cannot see inside the box.

### The Circuit Inputs

```
PRIVATE (only the prover knows):
  balance = 42_318_960_000   ← actual balance in micro-USDC ($42,318.96)
                               This never leaves the prover's device.

PUBLIC (visible to the verifier, embedded in the proof):
  threshold = 5_000_000_000  ← $5,000 minimum to prove
  asset_id  = 0x14f0d1...    ← identifies "USDC" (prevents asset-swap attacks)
  nonce     = 0x3a7c9f...    ← unique random value (prevents proof reuse)
```

### The Constraints (the math that's proven)

```noir
fn main(balance: u64, threshold: pub u64, asset_id: pub Field, nonce: pub Field) {
    // Constraint 1: The hidden balance is at least the public threshold
    assert(balance >= threshold);

    // Constraint 2: Prevent overflow tricks
    assert(balance <= 1_000_000_000_000_000);
}
```

When `nargo prove` runs, it generates a cryptographic proof `π` that:
- These constraints are satisfied, AND
- The prover knows a valid `balance` that satisfies them

Without knowing `balance` at all.

### Why Can't the Verifier Just Guess the Balance?

The security comes from the **BN254 elliptic curve**. The proof is a set of curve points `(A, B, C)` that satisfy a pairing equation. Finding a valid `(A, B, C)` without knowing the private input is computationally equivalent to solving the Discrete Logarithm Problem on a 254-bit elliptic curve — which would take longer than the age of the universe with all current computing power combined.

---

## 6. Soroban Smart Contract Explained

The contract lives in `Backend/contracts/verifier/src/lib.rs`. Here is what it does:

### What gets stored on-chain?

```
Verification Key (VK) — stored permanently in instance storage
  ├── alpha_g1  : [α]₁ — a G1 curve point (64 bytes)
  ├── beta_g2   : [β]₂ — a G2 curve point (128 bytes)
  ├── gamma_g2  : [γ]₂ — a G2 curve point (128 bytes)
  ├── delta_g2  : [δ]₂ — a G2 curve point (128 bytes)
  └── ic[0..3]  : Input Commitments — 4 G1 points binding the public inputs

Used Nonces — stored temporarily (expires in ~150 days)
  └── nonce → true  (prevents proof replay)
```

The VK is derived **directly from the Noir circuit source code**. If the circuit changes, the VK changes, and the old contract can no longer verify proofs from the new circuit. This immutability is a security feature.

### What happens when `verify_proof()` is called?

**Step 1 — Replay check**
```
Is this nonce already in storage? → return false immediately
```

**Step 2 — Prepare the Public Input Point**

The three public inputs are combined into one G1 point using the Input Commitments:

```
vk_x = IC[0]
     + threshold × IC[1]
     + asset_id  × IC[2]
     + nonce     × IC[3]
```

This uses `bn254_g1_mul()` and `bn254_g1_add()` — Stellar's native BN254 host functions running at near-zero cost.

**Step 3 — Groth16 Pairing Check**

The core verification equation is:

```
e(A, B) · e(−α, β) · e(−vk_x, γ) · e(−C, δ) == 1
```

Where `e(·, ·)` is the BN254 bilinear pairing. This equation has the magical property that it is:
- **Efficient** to check (one call to `bn254_pairing_check()`)
- **Impossible** to satisfy without a valid proof for the original circuit
- **Trustless** — no oracle, no trusted party, just math

**Step 4 — Record the nonce and return**

If the check passes, the nonce is stored to block replay, and `true` is returned.

### Contract Functions

| Function | Who calls it | What it does |
|---|---|---|
| `initialize(admin, vk)` | Deployer (once) | Sets the VK on-chain |
| `update_vk(vk)` | Admin only | Updates VK if circuit changes |
| `verify_proof(proof, inputs)` | Anyone | Returns TRUE / FALSE |
| `get_vk()` | Anyone | Read the current VK (transparency) |
| `is_nonce_used(nonce)` | Anyone | Check if a nonce was already consumed |

---

## 7. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| **ZK Circuit** | [Noir Lang](https://noir-lang.org) | Rust-like syntax, compiles to Barretenberg backend, generates BN254-compatible proofs |
| **Proving Backend** | [Barretenberg (bb)](https://github.com/AztecProtocol/aztec-packages/tree/master/barretenberg) | The official backend for Noir; generates Groth16 / UltraHonk proofs on BN254 |
| **Smart Contract** | Rust + [Soroban SDK](https://soroban.stellar.org) | Compiled to WASM, deployed on Stellar |
| **On-Chain Crypto** | Stellar BN254 Host Functions (Protocol 25+) | Native pairing checks at extremely low cost |
| **Blockchain** | [Stellar](https://stellar.org) Testnet → Mainnet | Fast, cheap, fintech-focused; 5s block time, ~$0.00001 tx fees |
| **Wallet** | [Freighter](https://freighter.app) | Standard Stellar browser extension wallet |
| **Frontend** | React + TypeScript + Vite + Tailwind CSS | Modern, fast, type-safe UI |

---

## 8. Project Structure

```
zkCred/
│
├── README.md                          ← You are here
│
├── Frontend/                          ← Zone B: React UI
│   ├── src/
│   │   ├── Landing.tsx                ← Main app (Home, Prover, Auditor views)
│   │   ├── App.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
└── Backend/                           ← Zone A: ZK + Smart Contract
    │
    ├── circuits/                      ← Noir ZK Circuit
    │   ├── Nargo.toml                 ← Noir package manifest
    │   ├── Prover.toml                ← Input values for proof generation
    │   └── src/
    │       └── main.nr                ← ★ THE ZK CIRCUIT (balance >= threshold)
    │
    ├── contracts/                     ← Soroban Rust Smart Contract
    │   ├── Cargo.toml                 ← Workspace manifest
    │   └── verifier/
    │       ├── Cargo.toml             ← Contract dependencies
    │       └── src/
    │           └── lib.rs             ← ★ THE VERIFIER CONTRACT (BN254 pairing)
    │
    └── scripts/                       ← Step-by-step automation
        ├── 1_compile_circuit.sh       ← nargo compile + bb write_vk
        ├── 2_generate_proof.sh        ← nargo execute + bb prove
        ├── 3_deploy_contract.sh       ← cargo build → stellar contract deploy
        └── 4_verify_proof.sh          ← stellar contract invoke verify_proof
```

---

## 9. Setup & Installation

### Prerequisites

You need three toolchains installed. On macOS/Linux:

#### A. Noir Language (Circuit Compiler)
```bash
# Install noirup (Noir version manager)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
source ~/.bashrc   # or restart terminal

# Install the latest Noir compiler
noirup

# Verify
nargo --version
# Expected: nargo version = 0.33.x
```

#### B. Barretenberg (Proof Generator)
```bash
# Install bbup (Barretenberg version manager)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash
source ~/.bashrc

# Install the latest bb
bbup

# Verify
bb --version
```

#### C. Rust + Soroban CLI (Contract Compiler & Deployer)
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Add WebAssembly compilation target
rustup target add wasm32-unknown-unknown

# Install Soroban CLI (Stellar's contract tool)
cargo install --locked soroban-cli

# Verify
stellar --version

# Create and fund a Testnet wallet
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet
```

#### D. Frontend
```bash
cd Frontend
npm install
```

---

## 10. Running the Full Demo

Follow these steps in order. Each step builds on the last.

### Step 1 — Compile the ZK Circuit

```bash
cd Backend
chmod +x scripts/*.sh
./scripts/1_compile_circuit.sh
```

**Output:** `circuits/target/balance_threshold.json` (circuit bytecode) and `circuits/target/vk` (verification key bytes)

---

### Step 2 — Edit Inputs and Generate a Proof

Open `Backend/circuits/Prover.toml` and set your values:

```toml
# Your actual balance (PRIVATE — stays on your machine)
balance = "42318960000"   # $42,318.96 USDC in micro-units (6 decimals)

# What you want to prove (PUBLIC — auditor sees this)
threshold = "5000000000"  # $5,000 USDC minimum

# The asset being proven
asset_id = "0x14f0d1c0b67fb52e8b8e81e73ff31b3a98ec7a7d2c3f0bc4e9e4c8a3d6f5b2e"

# A fresh random nonce (generate a new one each time)
nonce = "0x3a7c9f2d5e1b4a8c6d0f3e7b2a5d9c1f4e8b3d6a0c7f2e5b9d4a1c8f3e6b0d"
```

Then run:

```bash
./scripts/2_generate_proof.sh
```

**Output:** A proof string starting with `zkp_v1.` — this is what the prover sends to the auditor.

---

### Step 3 — Deploy the Contract (One-time)

```bash
./scripts/3_deploy_contract.sh
```

**Output:** A Stellar contract address like `CDFGT...X3KV`. Copy this into `Frontend/src/config.ts`.

---

### Step 4 — Verify a Proof On-Chain

```bash
./scripts/4_verify_proof.sh \
  "zkp_v1.abc123..." \   # The proof string from Step 2
  "5000000000"           \   # The threshold
  "0x14f0d1..."          \   # The asset_id
  "0x3a7c9f..."              # The nonce
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✅  VERIFIED — Balance EXCEEDS threshold
 The prover holds ≥ $5,000 USDC. Wallet remains private.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 5 — Run the Frontend

```bash
cd Frontend
npm run dev
```

Visit `http://localhost:5173` — the UI connects to your deployed contract automatically.

---

## 11. Why This Wins the Hackathon

The Stellar Development Foundation explicitly requested **"Real-World ZK"** applications with compliance, identity, and institutional settlement use cases. zkCred hits every criterion:

### Technical Alignment
- **Protocol 25/26 BN254 Host Functions** — We use `bn254_g1_mul`, `bn254_g1_add`, and `bn254_pairing_check` inside the Soroban verifier. This is the exact feature the SDF built for this kind of application.
- **Soroban Smart Contracts** — The verifier is fully on-chain, trustless, and permissionless.
- **Noir ZK Language** — Purpose-built for zero-knowledge proofs, modern Rust-like syntax.

### Real-World Use Cases (Multiple Markets)
| Market | Use Case | How zkCred Helps |
|---|---|---|
| **Real Estate** | Apartment rental applications | Prove $10K liquid without sharing bank statements |
| **B2B Commerce** | Net-30 supplier credit | Prove solvency without sharing financial records |
| **Immigration** | Visa proof-of-funds requirement | Prove $5K without revealing wallet to government |
| **DeFi** | Under-collateralized lending | ZK-native credit score based on provable holdings |
| **Freelancing** | Platform trust/verification | Prove freelancer solvency to enterprise clients |

### Why NOT Existing Solutions
- **Chainlink / Oracles** — Still expose wallet addresses; just relay the same data
- **Traditional KYC** — Requires sharing identity documents; defeats privacy
- **Privacy Coins** — Illegal in many jurisdictions; don't prove *enough* (you need to prove minimum, not hide everything)
- **zkCred** — Minimal disclosure. You prove only what you need to prove.

---

## 12. Team

**zkCred** was built for the **Stellar Hacks: Real-World ZK** hackathon by [Mide_xol].

- **Zone A (Backend / ZK):** Noir circuit design, Soroban contract, BN254 verification
- **Zone B (Frontend / UX):** React dashboard, Freighter integration, Auditor portal
- **Zone C (Documentation):** Architecture write-up, demo video, README

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

*Built on Stellar. Proven with Noir. Verified on-chain. Private by design.*
