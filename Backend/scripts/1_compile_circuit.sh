#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Compile the Noir ZK Circuit
#
# What this does:
#   • Runs `nargo compile` to turn main.nr into a circuit artifact
#   • Runs `bb write_vk` to extract the Groth16 Verification Key
#   • The VK is what gets embedded into the Soroban smart contract
#
# Prerequisites:
#   • Noir:         curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash && noirup
#   • Barretenberg: curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash && bbup
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

CIRCUITS_DIR="$(cd "$(dirname "$0")/../circuits" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " zkCred — Step 1: Compiling Noir Circuit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "→ Working directory: $CIRCUITS_DIR"
cd "$CIRCUITS_DIR"

# ── 1a. Compile the circuit ───────────────────────────────────────────────────
echo "→ Running: nargo compile"
nargo compile

echo ""
echo "✓ Circuit compiled → target/balance_threshold.json"

# ── 1b. Extract the Verification Key using Barretenberg ──────────────────────
echo ""
echo "→ Running: bb write_vk (extracts Groth16 VK from the compiled circuit)"
bb write_vk \
  --bytecode-path target/balance_threshold.json \
  --output-path   target/vk \
  --oracle-hash   keccak

echo ""
echo "✓ Verification Key written → target/vk"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " NEXT STEP: Run scripts/2_generate_proof.sh"
echo "  After editing Prover.toml with your real balance."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
