# zkCred — Refit Status & Continuation Notes

> Working doc for continuing the BLS12-381 refit (e.g. from a Claude Code
> session running inside WSL). Delete once the refit is complete.

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

### DONE
- [x] `Backend/contracts/verifier/src/lib.rs` rewritten to a real BLS12-381
      Groth16 verifier. Uses `g1_msm` to build
      `vk_x = IC[0] + threshold·IC[1] + asset_id·IC[2] + nonce·IC[3]`, then
      `pairing_check([A,-α,-vk_x,-C],[B,β,γ,δ])`. Encodings: G1=96B `be(x)||be(y)`,
      G2=192B, Fr=32B BE. Includes G1 negation over the BLS12-381 field prime,
      nonce replay protection, and 5 unit tests. (commit fd640bd)
- [x] Cargo.toml cleaned (dropped tokio), `.gitignore` added.

### NEXT — verify the contract builds (needs working toolchain)
```bash
cd Backend/contracts
cargo test  -p zkcred-verifier                              # validate pairing logic
cargo build -p zkcred-verifier --target wasm32-unknown-unknown --release
```
Windows native toolchain is broken (no MinGW-w64, no VS Build Tools). Use a
Linux toolchain. In WSL: `sudo apt-get install -y build-essential`, Rust +
`wasm32-unknown-unknown` already installed.

### TODO — the rest of the refit
1. **arkworks prover crate** (`Backend/prover/`): define the R1CS circuit, run
   trusted setup, prove. Write a **serialization adapter** from arkworks (LE,
   flagged) to Soroban's BE-uncompressed bytes (G1=96B, G2=192B, Fr=32B). This
   is the riskiest part — test the emitted VK+proof against the contract's
   `verify_proof` in a Soroban test before trusting it.
2. **Deploy**: install `stellar` CLI, `stellar contract deploy`, then
   `initialize(admin, vk)` with the real VK. The current on-chain contract
   `CDIH2J77BXLZFCQNWIFYCYC2G34RTJMPHPLI3MAHOHJZL4GE3ZHV55YX` is a pre-refit
   stub (deployed but never initialized) and must be replaced.
3. **Frontend** (`Frontend/src/Landing.tsx`): currently 100% mocked
   (`MOCK_PROOF`, scripted terminal, auditor always returns TRUE). Wire real
   Freighter connect, real Horizon balance read, run the prover, and submit the
   proof to the contract via the Stellar SDK. Update `Frontend/src/config.ts`
   with the new contract id.

## Toolchain quick reference (WSL Ubuntu-22.04)
- Rust 1.96 + `wasm32-unknown-unknown`: installed.
- `build-essential`: **install required** (needs sudo).
- `stellar` CLI: not installed. Prefer the prebuilt installer over `cargo install`.
- Project on Windows fs: `/mnt/c/Users/user/zkCred` (slow to build). Cloning into
  `~` is faster.
