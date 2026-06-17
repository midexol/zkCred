#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Build & Deploy the Soroban Verifier Contract
#
# What this does:
#   • Compiles the Rust contract to WASM
#   • Deploys it to Stellar Testnet via Soroban CLI
#   • Calls `initialize()` to write the circuit VK on-chain
#   • Prints the deployed Contract ID (needed for Step 4 and the Frontend)
#
# Prerequisites:
#   • Rust (wasm32 target): rustup target add wasm32-unknown-unknown
#   • Soroban CLI: cargo install --locked soroban-cli
#   • Stellar account funded on Testnet: stellar keys generate deployer --network testnet
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$BACKEND_DIR/contracts"
CIRCUITS_DIR="$BACKEND_DIR/circuits"
NETWORK="testnet"
ACCOUNT="deployer"  # Change to your funded testnet account alias

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " zkCred — Step 3: Deploy Soroban Verifier"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 3a. Compile the contract to WASM ─────────────────────────────────────────
echo ""
echo "→ Building Rust contract → WASM (release)"
cd "$CONTRACTS_DIR"
cargo build \
  --package zkcred-verifier \
  --target wasm32-unknown-unknown \
  --release

WASM_PATH="$CONTRACTS_DIR/target/wasm32-unknown-unknown/release/zkcred_verifier.wasm"
echo "✓ WASM built → $WASM_PATH"

# ── 3b. Optimize WASM size (optional but recommended for Soroban) ─────────────
echo ""
echo "→ Optimizing WASM with stellar contract optimize"
stellar contract optimize \
  --wasm "$WASM_PATH" \
  --wasm-out "$WASM_PATH.optimized.wasm"

echo "✓ Optimized WASM → $WASM_PATH.optimized.wasm"

# ── 3c. Deploy to Stellar Testnet ────────────────────────────────────────────
echo ""
echo "→ Deploying to Stellar $NETWORK ..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH.optimized.wasm" \
  --source "$ACCOUNT" \
  --network "$NETWORK")

echo "✓ Deployed! Contract ID: $CONTRACT_ID"
echo "$CONTRACT_ID" > "$BACKEND_DIR/scripts/.contract_id"

# ── 3d. Read VK bytes from the compiled circuit ───────────────────────────────
#
# The Verification Key was written to circuits/target/vk by bb write_vk.
# We encode it as hex to pass to the initialize() call.
VK_HEX=$(xxd -p "$CIRCUITS_DIR/target/vk" | tr -d '\n')
echo ""
echo "→ VK bytes (hex): ${VK_HEX:0:64}..."

# ── 3e. Initialize the contract with the Verification Key ────────────────────
#
# NOTE: The VK structure (alpha_g1, beta_g2, gamma_g2, delta_g2, ic array)
# must be passed as separate XDR-encoded arguments. The exact format depends
# on how `stellar contract invoke` serializes the VerificationKey struct.
#
# For the hackathon demo, replace the placeholder values below with the
# actual hex bytes from circuits/target/vk after running Step 1.

echo ""
echo "→ Calling initialize() on deployed contract..."
stellar contract invoke \
  --id     "$CONTRACT_ID" \
  --source "$ACCOUNT" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$(stellar keys address $ACCOUNT)" \
  --vk "{ \
    \"alpha_g1\": \"$(xxd -p "$CIRCUITS_DIR/target/vk" | head -c 128 | tr -d '\n')\", \
    \"beta_g2\":  \"placeholder_replace_with_real_vk_bytes\", \
    \"gamma_g2\": \"placeholder_replace_with_real_vk_bytes\", \
    \"delta_g2\": \"placeholder_replace_with_real_vk_bytes\", \
    \"ic\": [] \
  }"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✓ Deployment complete!"
echo ""
echo "   Contract ID : $CONTRACT_ID"
echo "   Network     : $NETWORK"
echo ""
echo " Copy this Contract ID into:"
echo "   Frontend/src/config.ts  → VERIFIER_CONTRACT_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " NEXT STEP: Run scripts/4_verify_proof.sh <PROOF_HEX>"
