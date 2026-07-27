#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 0 — Build & Run the Arkworks Groth16 Prover Setup
#
# Outputs:
#   Backend/prover/vk.json          — Verification Key (Soroban byte format)
#   Backend/prover/proving_key.bin  — Proving Key (used by `prove` subcommand)
#
# Prerequisites (all available in WSL Ubuntu):
#   • Rust + cargo (stable)
#   • Internet access (cargo fetches dependencies on first run)
#
# Run from any directory — the script resolves paths automatically.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROVER_DIR="$SCRIPT_DIR/../prover"
OUT_DIR="$PROVER_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " zkCred — Step 0: Groth16 Trusted Setup"
echo " Curve: BLS12-381  |  Backend: arkworks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROVER_DIR"

echo "→ Building prover binary (release)…"
echo "  (First build fetches arkworks crates — may take 2–5 minutes)"
cargo build --release

echo ""
echo "✓ Prover binary built."
echo ""
echo "→ Running trusted setup…"

./target/release/zkcred-prover --out-dir "$OUT_DIR" setup

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Setup complete!"
echo ""
echo " Files created:"
echo "   $OUT_DIR/vk.json           ← copy to Frontend if needed"
echo "   $OUT_DIR/proving_key.bin   ← keep private"
echo ""
echo " NEXT STEPS:"
echo "   1. Deploy the verifier contract (initializing with vk.json):"
echo "      bash Backend/scripts/3_deploy_contract.sh"
echo ""
echo "   2. Or generate a test proof now:"
echo "      bash Backend/scripts/1_prove_demo.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
