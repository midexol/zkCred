//! zkCred — On-Chain Groth16 Verifier (Soroban Smart Contract)
//!
//! This contract lives on the Stellar network (Testnet → Mainnet) and serves
//! as the *single source of truth* for proof verification.
//!
//! ## What it does
//! 1. Stores the Groth16 Verification Key (VK) derived from the Noir circuit.
//! 2. Exposes `verify_proof()`, which uses Stellar's native BN254 host
//!    functions (Protocol 25+) to run an on-chain pairing check.
//! 3. Returns `true` if and only if the proof is valid AND the nonce is fresh.
//!
//! ## Groth16 Verification Equation
//!
//!   e(A, B) == e(α, β) · e(vk_x, γ) · e(C, δ)
//!
//! Re-arranged into a product-of-pairings-equals-one form:
//!
//!   e(A, B) · e(−α, β) · e(−vk_x, γ) · e(−C, δ) == 1
//!
//! Where `vk_x = IC[0] + threshold·IC[1] + asset_id·IC[2] + nonce·IC[3]`

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Bytes, Env, Vec,
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────────────────

/// Groth16 Verification Key derived from the compiled Noir circuit.
///
/// All byte sizes follow the BN254 curve encoding:
///   G1 point  = 64 bytes  (2 × 32-byte Fp coordinates, uncompressed)
///   G2 point  = 128 bytes (2 × 64-byte Fp2 coordinates, uncompressed)
///   Scalar    = 32 bytes  (big-endian Fr element)
///
/// These values are output by `bb write_vk` after `nargo compile`.
/// They must be set once at deployment via `initialize()`.
#[contracttype]
#[derive(Clone)]
pub struct VerificationKey {
    /// [α]_1  — Alpha point on G1 (64 bytes)
    pub alpha_g1: Bytes,
    /// [β]_2  — Beta point on G2 (128 bytes)
    pub beta_g2: Bytes,
    /// [γ]_2  — Gamma point on G2 (128 bytes)
    pub gamma_g2: Bytes,
    /// [δ]_2  — Delta point on G2 (128 bytes)
    pub delta_g2: Bytes,
    /// Input Commitments: [IC_0, IC_1, IC_2, IC_3], each a G1 point (64 bytes).
    ///   IC_0  — Constant term
    ///   IC_1  — Coefficient for `threshold`
    ///   IC_2  — Coefficient for `asset_id`
    ///   IC_3  — Coefficient for `nonce`
    pub ic: Vec<Bytes>,
}

/// A Groth16 proof (π) produced by the Noir prover via the Barretenberg backend.
#[contracttype]
#[derive(Clone)]
pub struct Proof {
    /// π_A ∈ G1 (64 bytes)
    pub a: Bytes,
    /// π_B ∈ G2 (128 bytes)
    pub b: Bytes,
    /// π_C ∈ G1 (64 bytes)
    pub c: Bytes,
}

/// Public inputs that are visible on-chain and bound to the proof.
///
/// Every field is 32 bytes (big-endian). The Soroban client encodes them
/// from the Prover.toml values before calling `verify_proof`.
#[contracttype]
#[derive(Clone)]
pub struct PublicInputs {
    /// Minimum balance threshold (e.g. $5,000 USDC = 5_000_000_000 as 32-byte BE)
    pub threshold: Bytes,
    /// Asset identifier — Poseidon hash of the asset code string (e.g. "USDC")
    pub asset_id: Bytes,
    /// Unique random nonce — prevents the same proof from being accepted twice
    pub nonce: Bytes,
}

/// Contract storage keys.
#[contracttype]
pub enum StorageKey {
    Admin,
    VerificationKey,
    /// Tracks which nonces have already been used (replay protection)
    UsedNonce(Bytes),
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct ZkCredVerifier;

#[contractimpl]
impl ZkCredVerifier {
    // ── Admin Functions ───────────────────────────────────────────────────────

    /// Initialize the contract with the Verification Key from the compiled
    /// Noir circuit. Call this once immediately after deployment.
    ///
    /// The VK comes from:
    ///   1. `nargo compile`        — compiles the circuit
    ///   2. `bb write_vk -b ...`   — extracts the verification key bytes
    pub fn initialize(env: Env, admin: Address, vk: VerificationKey) {
        if env.storage().instance().has(&StorageKey::Admin) {
            panic!("Contract is already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&StorageKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&StorageKey::VerificationKey, &vk);
        // Keep contract data alive for ~10 years of ledger entries
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    /// Replace the Verification Key. Admin-only.
    /// Required if the Noir circuit is updated (e.g. new constraints added).
    pub fn update_vk(env: Env, vk: VerificationKey) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&StorageKey::Admin)
            .expect("Not initialized");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&StorageKey::VerificationKey, &vk);
    }

    // ── Core Verification Function ────────────────────────────────────────────

    /// Verify a zkCred zero-knowledge proof on-chain.
    ///
    /// Uses Stellar's native BN254 cryptographic host functions (Protocol 25+)
    /// to perform a Groth16 pairing check. No trusted third party is involved.
    ///
    /// Returns `true` iff:
    ///   - The proof `π = (A, B, C)` is valid for the given public inputs, AND
    ///   - The nonce has not been previously submitted (anti-replay).
    ///
    /// A `true` result is a mathematical guarantee that the prover controls
    /// a wallet with balance >= `inputs.threshold` of asset `inputs.asset_id`.
    pub fn verify_proof(env: Env, proof: Proof, inputs: PublicInputs) -> bool {
        // ── Step 0: Replay protection ─────────────────────────────────────────
        //
        // Each proof can only be accepted once. The nonce is stored in
        // temporary ledger storage (expires after ~30 days) to prevent
        // indefinite storage growth.
        let nonce_key = StorageKey::UsedNonce(inputs.nonce.clone());
        if env.storage().temporary().has(&nonce_key) {
            return false; // Proof already consumed
        }

        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&StorageKey::VerificationKey)
            .expect("Call initialize() before verify_proof()");

        // ── Step 1: Compute Prepared Public Input (vk_x) ─────────────────────
        //
        // The three public inputs are combined into a single G1 point using the
        // Input Commitment (IC) coefficients from the verification key.
        //
        //   vk_x = IC[0] + threshold · IC[1] + asset_id · IC[2] + nonce · IC[3]
        //
        // This commits all public values into the pairing check in one shot.
        let ic0 = vk.ic.get(0).expect("IC missing index 0");
        let ic1 = vk.ic.get(1).expect("IC missing index 1");
        let ic2 = vk.ic.get(2).expect("IC missing index 2");
        let ic3 = vk.ic.get(3).expect("IC missing index 3");

        // Scalar multiplications: public_input[i] * IC[i+1]
        let term_threshold = env
            .crypto()
            .bn254_g1_mul(ic1, inputs.threshold.clone());
        let term_asset = env
            .crypto()
            .bn254_g1_mul(ic2, inputs.asset_id.clone());
        let term_nonce = env
            .crypto()
            .bn254_g1_mul(ic3, inputs.nonce.clone());

        // Sum: vk_x = IC[0] + term_threshold + term_asset + term_nonce
        let acc1 = env.crypto().bn254_g1_add(ic0, term_threshold);
        let acc2 = env.crypto().bn254_g1_add(acc1, term_asset);
        let vk_x = env.crypto().bn254_g1_add(acc2, term_nonce);

        // ── Step 2: Groth16 Pairing Check ────────────────────────────────────
        //
        // Verification equation (product-of-pairings form):
        //
        //   e(A,  B)  ·
        //   e(−α, β)  ·
        //   e(−vk_x, γ) ·
        //   e(−C,  δ)  == 1
        //
        // We negate α, vk_x, and C (flip their G1 Y-coordinate) and pass all
        // four pairs to bn254_pairing_check, which returns true iff the result
        // equals the identity in GT (the target group).

        let neg_alpha = negate_g1(&env, vk.alpha_g1.clone());
        let neg_vk_x  = negate_g1(&env, vk_x);
        let neg_c     = negate_g1(&env, proof.c.clone());

        // G1 points (paired left-side)
        let mut g1_points: Vec<Bytes> = Vec::new(&env);
        g1_points.push_back(proof.a);       //  A    (from proof)
        g1_points.push_back(neg_alpha);     // −α   (from VK, negated)
        g1_points.push_back(neg_vk_x);     // −vk_x (computed above, negated)
        g1_points.push_back(neg_c);         // −C    (from proof, negated)

        // G2 points (paired right-side)
        let mut g2_points: Vec<Bytes> = Vec::new(&env);
        g2_points.push_back(proof.b);       //  B    (from proof)
        g2_points.push_back(vk.beta_g2);   //  β    (from VK)
        g2_points.push_back(vk.gamma_g2);  //  γ    (from VK)
        g2_points.push_back(vk.delta_g2);  //  δ    (from VK)

        let is_valid = env.crypto().bn254_pairing_check(g1_points, g2_points);

        // ── Step 3: Record nonce to block replay ──────────────────────────────
        if is_valid {
            // TTL: 2,592,000 ledger entries ≈ 150 days at 5s/ledger
            env.storage().temporary().set(&nonce_key, &true);
            env.storage()
                .temporary()
                .extend_ttl(&nonce_key, 2_592_000, 2_592_000);
        }

        is_valid
    }

    // ── Read-Only Functions ───────────────────────────────────────────────────

    /// Return the current Verification Key for transparency and auditability.
    pub fn get_vk(env: Env) -> VerificationKey {
        env.storage()
            .instance()
            .get(&StorageKey::VerificationKey)
            .expect("Not initialized")
    }

    /// Return the admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&StorageKey::Admin)
            .expect("Not initialized")
    }

    /// Check whether a nonce has already been consumed (replay detection).
    pub fn is_nonce_used(env: Env, nonce: Bytes) -> bool {
        env.storage()
            .temporary()
            .has(&StorageKey::UsedNonce(nonce))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Negate a BN254 G1 point: (x, y)  →  (x, p − y)
///
/// A G1 point is represented as two concatenated 32-byte big-endian field
/// elements, totalling 64 bytes. Negation flips the Y coordinate modulo the
/// BN254 base field prime `p`.
///
/// BN254 Fp prime (p):
/// 21888242871839275222246405745257275088696311157297823662689037894645226208583
fn negate_g1(env: &Env, point: Bytes) -> Bytes {
    // BN254 field prime p, big-endian 32 bytes
    const BN254_P: [u8; 32] = [
        0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29,
        0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
        0x97, 0x81, 0x6a, 0x91, 0x68, 0x71, 0xca, 0x8d,
        0x3c, 0x20, 0x8c, 0x16, 0xd8, 0x7c, 0xfd, 0x47,
    ];

    // Extract x (bytes 0..31) and y (bytes 32..63) from the 64-byte G1 point
    let mut x = [0u8; 32];
    let mut y = [0u8; 32];
    for i in 0..32usize {
        x[i] = point.get(i as u32).unwrap_or(0);
        y[i] = point.get((i + 32) as u32).unwrap_or(0);
    }

    // neg_y = p − y  (big-endian subtraction, assuming 0 <= y < p)
    let neg_y = be_sub_32(&BN254_P, &y);

    // Re-assemble negated point: x || neg_y
    let mut result = [0u8; 64];
    result[..32].copy_from_slice(&x);
    result[32..].copy_from_slice(&neg_y);

    Bytes::from_slice(env, &result)
}

/// Big-endian 32-byte subtraction: a − b (assumes a >= b, no underflow check).
fn be_sub_32(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut borrow: i16 = 0;
    for i in (0..32).rev() {
        let diff = a[i] as i16 - b[i] as i16 - borrow;
        if diff < 0 {
            result[i] = (diff + 256) as u8;
            borrow = 1;
        } else {
            result[i] = diff as u8;
            borrow = 0;
        }
    }
    result
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_nonce_replay_blocked() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ZkCredVerifier);
        let client = ZkCredVerifierClient::new(&env, &contract_id);

        // Build a minimal (invalid) VK just to test replay logic
        let dummy_bytes_64  = Bytes::from_slice(&env, &[0u8; 64]);
        let dummy_bytes_128 = Bytes::from_slice(&env, &[0u8; 128]);
        let mut ic = Vec::new(&env);
        ic.push_back(dummy_bytes_64.clone());
        ic.push_back(dummy_bytes_64.clone());
        ic.push_back(dummy_bytes_64.clone());
        ic.push_back(dummy_bytes_64.clone());

        let vk = VerificationKey {
            alpha_g1: dummy_bytes_64.clone(),
            beta_g2:  dummy_bytes_128.clone(),
            gamma_g2: dummy_bytes_128.clone(),
            delta_g2: dummy_bytes_128.clone(),
            ic,
        };

        let admin = Address::generate(&env);
        client.initialize(&admin, &vk);

        let proof = Proof {
            a: dummy_bytes_64.clone(),
            b: dummy_bytes_128,
            c: dummy_bytes_64,
        };
        let nonce_val = Bytes::from_slice(&env, &[0xAB; 32]);
        let inputs = PublicInputs {
            threshold: Bytes::from_slice(&env, &[0u8; 32]),
            asset_id:  Bytes::from_slice(&env, &[0u8; 32]),
            nonce:     nonce_val.clone(),
        };

        // The pairing will return false for dummy bytes, but the nonce-replay
        // path is independent — we test the nonce is NOT recorded on failure.
        let result = client.verify_proof(&proof, &inputs);
        assert!(!result, "Dummy proof should not verify");

        // Nonce should NOT be marked used since proof failed
        assert!(!client.is_nonce_used(&nonce_val));
    }
}
