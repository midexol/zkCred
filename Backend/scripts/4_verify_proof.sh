#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Verify a Proof On-Chain (Auditor / Verifier side)
#
# What this does:
#   • Takes a proof hex string (from the prover)
#   • Calls verify_proof() on the deployed Soroban contract
#   • Prints TRUE or FALSE — the only information the auditor ever learns
#
# Usage:
#   ./4_verify_proof.sh <PROOF_HEX> <THRESHOLD> <ASSET_ID> <NONCE>
#
# Example:
#   ./4_verify_proof.sh zkp_v1.abc123... 5000000000 0x14f0d1... 0x3a7c9f...
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

NETWORK="testnet"
ACCOUNT="deployer"
CONTRACT_ID_FILE="$(dirname "$0")/.contract_id"

if [ ! -f "$CONTRACT_ID_FILE" ]; then
  echo "ERROR: No contract ID found. Run 3_deploy_contract.sh first."
  exit 1
fi

CONTRACT_ID=$(cat "$CONTRACT_ID_FILE")

PROOF_HEX="${1:?Usage: $0 <PROOF_HEX> <THRESHOLD> <ASSET_ID> <NONCE>}"
THRESHOLD="${2:?Provide threshold (e.g. 5000000000)}"
ASSET_ID="${3:?Provide asset_id (32-byte hex)}"
NONCE="${4:?Provide nonce (32-byte hex)}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " zkCred — Step 4: On-Chain Proof Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "→ Contract  : $CONTRACT_ID"
echo "→ Network   : $NETWORK"
echo "→ Threshold : $THRESHOLD micro-units"
echo "→ Asset ID  : $ASSET_ID"
echo "→ Nonce     : $NONCE"
echo ""
echo "→ Calling verify_proof() ..."
echo ""

RESULT=$(stellar contract invoke \
  --id      "$CONTRACT_ID" \
  --source  "$ACCOUNT" \
  --network "$NETWORK" \
  -- verify_proof \
  --proof  "$PROOF_HEX" \
  --inputs "{ \"threshold\": \"$THRESHOLD\", \"asset_id\": \"$ASSET_ID\", \"nonce\": \"$NONCE\" }")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$RESULT" = "true" ]; then
  echo " ✅  VERIFIED — Balance EXCEEDS threshold"
  echo ""
  echo " The cryptographic proof is valid."
  echo " The prover holds >= $THRESHOLD micro-units of asset $ASSET_ID."
  echo " Their wallet address and exact balance remain completely private."
else
  echo " ❌  INVALID — Proof verification FAILED"
  echo ""
  echo " The proof is invalid or the nonce has already been used."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
