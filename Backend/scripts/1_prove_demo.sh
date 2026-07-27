#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Demo: Generate a test proof with known inputs
#
# Uses the proving_key.bin from Step 0 to create a proof for:
#   balance   = $42,318.96 USDC  (42_318_960_000 micro-USDC)
#   threshold = $5,000.00  USDC  (5_000_000_000  micro-USDC)
#   asset_id  = field hash of "USDC"
#   nonce     = randomly generated
#
# Output: Backend/prover/proof.json
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROVER_DIR="$SCRIPT_DIR/../prover"

cd "$PROVER_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " zkCred — Demo Proof Generation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# asset_id: first 32 bytes of keccak256("USDC") as BE hex
# Using a deterministic placeholder; replace with your actual Poseidon/keccak hash
ASSET_ID_HEX="14f0d1c0b67fb52e8b8e81e73ff31b3a98ec7a7d2c3f0bc4e9e4c8a3d6f5b2e"

./target/release/zkcred-prover \
  --out-dir "$PROVER_DIR" \
  prove \
  --balance   42318960000 \
  --threshold  5000000000 \
  --asset-id  "$ASSET_ID_HEX"
  # --nonce omitted → auto-generated fresh random nonce

echo ""
echo " proof.json is ready. Paste its contents into the Auditor tab"
echo " in the frontend to verify on-chain."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
