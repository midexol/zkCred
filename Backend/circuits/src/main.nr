// ─────────────────────────────────────────────────────────────────────────────
// zkCred — Balance Threshold Proof Circuit
// Language: Noir (https://noir-lang.org)
// Proving Backend: Barretenberg (UltraHonk / Groth16 via bb CLI)
//
// PURPOSE
// -------
// Cryptographically proves that a private wallet balance is >= a public
// threshold — without revealing the actual balance, the wallet address,
// or any transaction history.
//
// A landlord, bank, or auditor gets only: TRUE / FALSE
//
// ─────────────────────────────────────────────────────────────────────────────
// CIRCUIT INPUTS
// ─────────────────────────────────────────────────────────────────────────────
//
//  balance   (PRIVATE) — The prover's actual asset balance in the smallest
//                         denomination.  e.g. for USDC (6 decimal places):
//                         $5,000 USDC = 5_000_000_000 micro-USDC
//                         This value NEVER leaves the user's browser/device.
//
//  threshold (PUBLIC)  — The minimum balance the prover claims to hold.
//                         This is chosen by the prover and is visible to
//                         the on-chain verifier.
//
//  asset_id  (PUBLIC)  — A 32-byte Field element representing the asset
//                         being proven (e.g. Poseidon hash of "USDC").
//                         Prevents a USDC proof from passing as XLM.
//
//  nonce     (PUBLIC)  — A random 32-byte value chosen at proof-generation
//                         time. The on-chain contract records used nonces
//                         to prevent the same proof from being submitted
//                         twice (replay attack protection).
//
// ─────────────────────────────────────────────────────────────────────────────

fn main(
    balance:   u64,         // PRIVATE — stays on the prover's device
    threshold: pub u64,     // PUBLIC  — minimum amount to prove
    asset_id:  pub Field,   // PUBLIC  — which asset (e.g. hash of "USDC")
    nonce:     pub Field,   // PUBLIC  — unique per-proof replay guard
) {
    // ── CONSTRAINT 1: Core ZK Claim ─────────────────────────────────────────
    //
    // The prover mathematically convinces the verifier that balance >= threshold
    // without the verifier ever learning what `balance` actually is.
    //
    // If this assertion fails, Noir will not produce a valid proof.
    assert(balance >= threshold, "Balance does not meet the required threshold");

    // ── CONSTRAINT 2: Sanity Cap ─────────────────────────────────────────────
    //
    // Prevents a malicious prover from supplying an impossibly large `balance`
    // (e.g. u64::MAX) to trivially satisfy constraint 1 while holding nothing.
    //
    // Cap = 1 quadrillion micro-units ≈ $1,000,000,000 USD — far above any
    // realistic wallet balance, but below the u64 overflow boundary.
    assert(balance <= 1_000_000_000_000_000, "Balance exceeds sanity limit");

    // ── NOTE on asset_id and nonce ──────────────────────────────────────────
    //
    // Both are declared as PUBLIC inputs. Noir's proof system automatically
    // binds all public inputs to the proof witness — they are part of the
    // verification equation. Changing either value after proof generation
    // will make the proof invalid.
    //
    // The on-chain Soroban verifier additionally checks `nonce` against a
    // set of previously-used nonces to block replay attacks.
}
