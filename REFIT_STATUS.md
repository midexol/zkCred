# zkCred — Refit Status & Continuation Notes

## Goal
Make zkCred a **real end-to-end ZK** proof-of-funds for the "Stellar Hacks:
Real-World ZK" hackathon: generate a real proof and verify it **on-chain** on
Stellar Soroban.

## Why the original design didn't work
All three layers spoke different crypto languages:
- Contract called `env.crypto().bn254_*` — **those host functions don't exist**
  in soroban-sdk 22 (only **BLS12-381** is available), so it never compiled.
- Noir + Barretenberg emit **UltraHonk over BN254**, not Groth16.
- Stellar's released protocol exposes **BLS12-381**, not BN254.

## The refit: align everything on BLS12-381 Groth16
| Layer | Target |
|---|---|
| Circuit | arkworks R1CS (`ark-relations`) — `balance >= threshold` |
| Prover | `ark-groth16` over `ark-bls12-381` + trusted setup |
| Contract | `env.crypto().bls12_381()` — `g1_msm` + `pairing_check` |

## Status

### COMPLETED
- [x] **Verifier Contract**: `Backend/contracts/verifier/src/lib.rs` written as a real BLS12-381
      Groth16 verifier using `g1_msm` and `pairing_check`. Includes G1 point negation over field prime,
      replay protection via stored nonces, and 5 unit tests.
- [x] **Arkworks Prover Crate**: Built `Backend/prover/` crate with:
      - `circuit.rs`: R1CS circuit (`balance >= threshold`, `balance <= SANITY_CAP`) using `ark-r1cs-std` gadgets + unit tests.
      - `serializer.rs`: Arkworks LE-compressed → Soroban BE-uncompressed format adapter (G1=96B, G2=192B, Fr=32B).
      - `main.rs`: CLI supporting `setup` (Groth16 setup → `vk.json` + `proving_key.bin`), `prove` (creates `proof.json`), and `serve` (HTTP server on `localhost:3001`).
- [x] **Deployment Scripts**:
      - `Backend/scripts/0_prover_setup.sh`: builds prover & runs trusted setup producing `vk.json`.
      - `Backend/scripts/1_prove_demo.sh`: generates test proof payload using `proving_key.bin`.
      - `Backend/scripts/3_deploy_contract.sh`: compiles WASM, deploys to testnet, invokes `initialize()` with real `vk.json` bytes, and auto-patches `Frontend/src/config.ts`.
- [x] **Frontend Integration**:
      - `Frontend/src/lib/freighter.ts`: real Freighter wallet connection & transaction signing via `@stellar/freighter-api`.
      - `Frontend/src/lib/horizon.ts`: real Horizon balance fetching for connected account (XLM, USDC, EURC).
      - `Frontend/src/lib/prover.ts`: client module calling local prover HTTP API with fallback demo payload.
      - `Frontend/src/lib/soroban.ts`: real Soroban contract invocation for `verify_proof()` using `@stellar/stellar-sdk` simulation and live execution.
      - `Frontend/src/Landing.tsx`: re-wired UI connecting wallet, live Horizon balances, real prover client, real auditor contract verification, and updated BLS12-381/Groth16/arkworks branding.

---

## Quick Reference / How to Run

### 1. Build and Initialize (WSL / Linux)
```bash
# 1. Generate trusted setup parameters and vk.json
bash Backend/scripts/0_prover_setup.sh

# 2. Deploy verifier contract and initialize with real VK on Testnet
bash Backend/scripts/3_deploy_contract.sh
```

### 2. Start Prover API (Optional, for live local proving)
```bash
cd Backend/prover
cargo run --release -- serve --port 3001
```

### 3. Run Frontend
```bash
cd Frontend
npm run dev
```
