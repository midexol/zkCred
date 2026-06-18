#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Generate a Zero-Knowledge Proof (Prover side)
#
# What this does:
#   • Reads inputs from circuits/Prover.toml
#   • Runs the Noir witness generation (`nargo execute`)
#   • Generates a Groth16 proof (`bb prove`)
#   • Outputs: target/proof  — the bytes the user shares with an auditor
#
# The private `balance` field in Prover.toml NEVER leaves this machine.
# The output proof only attests "balance >= threshold" — nothing more.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

CIRCUITS_DIR="$(cd "$(dirname "$0")/../circuits" && pwd)"
cd "$CIRCUITS_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " zkCred — Step 2: Generating ZK Proof"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "→ Reading inputs from: Prover.toml"
echo "→ Private balance stays on this device."

# ── 2a. Generate the witness (executes the circuit with real inputs) ──────────
echo ""
echo "→ Running: nargo execute (generating witness)"
nargo execute witness

echo ""
echo "✓ Witness generated → target/witness"

# ── 2b. Generate the Groth16 proof ───────────────────────────────────────────
echo ""
echo "→ Running: bb prove (generating Groth16 proof via BN254)"
bb prove \
  --bytecode-path  target/balance_threshold.json \
  --witness-path   target/witness \
  --output-path    target/proof

echo ""
echo "✓ ZK Proof generated → target/proof"

# ── 2c. Display the proof as a hex string (shareable with auditors) ───────────
PROOF_HEX=$(xxd -p target/proof | tr -d '\n')
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " YOUR PROOF (send this to the auditor)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "zkp_v1.${PROOF_HEX}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " NEXT STEP: Run scripts/3_deploy_contract.sh"
echo "  (only needed once — to put the VK on-chain)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
