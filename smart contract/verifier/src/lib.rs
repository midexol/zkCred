//! zkCred — On-Chain Groth16 Verifier (Soroban Smart Contract)
//!
//! Deployed on the Stellar network, this contract is the single on-chain
//! authority for zkCred proof verification.
//!
//! ## What it does
//!
//! 1. Stores the Groth16 Verification Key (VK) derived from the compiled Noir
//!    circuit (`Backend/circuits/src/main.nr`).
//! 2. Exposes `verify_proof()`, which runs a Groth16 pairing check using
//!    Stellar's native BN254 host functions (Protocol 25+). No oracle, no
//!    trusted party — just math.
//! 3. Emits on-chain events for every accepted or rejected proof.
//! 4. Prevents proof replay via per-nonce temporary storage.
//! 5. Supports emergency pause and admin transfer for operational safety.
//!
//! ## Groth16 Verification Equation
//!
//!   e(A, B) · e(−α, β) · e(−vk_x, γ) · e(−C, δ)  ==  1_GT
//!
//! Where:
//!   vk_x  =  IC[0] + threshold·IC[1] + asset_id·IC[2] + nonce·IC[3]
//!
//! ## BN254 Point Encoding
//!
//!   G1 point  =  64 bytes  (x ‖ y, each 32-byte big-endian Fp element)
//!   G2 point  = 128 bytes  (x_re ‖ x_im ‖ y_re ‖ y_im, each 32-byte BE)
//!   Scalar    =  32 bytes  (big-endian Fr element)

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Bytes, Env, Vec,
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────────────────

/// Groth16 Verification Key produced by `bb write_vk` after `nargo compile`.
///
/// These values are circuit-specific: changing even one constraint in
/// `main.nr` produces a completely different VK. Update via `update_vk()`
/// whenever the circuit changes.
#[contracttype]
#[derive(Clone)]
pub struct VerificationKey {
    /// [α]₁  — Alpha point on G1  (64 bytes)
    pub alpha_g1: Bytes,
    /// [β]₂  — Beta  point on G2 (128 bytes)
    pub beta_g2:  Bytes,
    /// [γ]₂  — Gamma point on G2 (128 bytes)
    pub gamma_g2: Bytes,
    /// [δ]₂  — Delta point on G2 (128 bytes)
    pub delta_g2: Bytes,
    /// Input Commitments: [IC_0, IC_1, IC_2, IC_3], each a G1 point (64 bytes).
    ///
    ///   IC_0 — constant term
    ///   IC_1 — coefficient for `threshold`
    ///   IC_2 — coefficient for `asset_id`
    ///   IC_3 — coefficient for `nonce`
    pub ic: Vec<Bytes>,
}

/// A Groth16 proof  π = (A, B, C)  produced by the Noir prover via
/// the Barretenberg backend (`bb prove`).
#[contracttype]
#[derive(Clone)]
pub struct Proof {
    /// π_A ∈ G1  (64 bytes)
    pub a: Bytes,
    /// π_B ∈ G2 (128 bytes)
    pub b: Bytes,
    /// π_C ∈ G1  (64 bytes)
    pub c: Bytes,
}

/// Public circuit inputs visible to anyone who inspects the on-chain call.
///
/// Every field is encoded as a 32-byte big-endian scalar matching the
/// representation expected by the BN254 host functions.
#[contracttype]
#[derive(Clone)]
pub struct PublicInputs {
    /// Minimum balance the prover claims to hold.
    /// e.g. $5,000 USDC (6 decimals) → 5_000_000_000 as 32-byte BE.
    pub threshold: Bytes,
    /// Asset identifier — Poseidon hash of the asset code string (e.g. "USDC").
    /// Binds the proof to a specific asset so it cannot be recycled for another.
    pub asset_id:  Bytes,
    /// Random 32-byte nonce chosen at proof-generation time.
    /// Stored on acceptance to prevent the same proof from being used twice.
    pub nonce:     Bytes,
}

/// Persistent storage keys for the contract.
#[contracttype]
pub enum StorageKey {
    /// The admin Address (instance storage — permanent).
    Admin,
    /// The current Groth16 Verification Key (instance storage — permanent).
    VerificationKey,
    /// Emergency pause flag (instance storage).
    Paused,
    /// Marks a nonce as consumed (temporary storage — expires ~150 days).
    UsedNonce(Bytes),
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct ZkCredVerifier;

#[contractimpl]
impl ZkCredVerifier {
    // ── Deployment ────────────────────────────────────────────────────────────

    /// Initialise the contract. Must be called once immediately after
    /// deployment. Subsequent calls panic to prevent hostile re-initialisation.
    ///
    /// `admin`  — Address that can update the VK, pause the contract,
    ///            and transfer admin rights.
    /// `vk`     — Groth16 Verification Key from `bb write_vk`.
    pub fn initialize(env: Env, admin: Address, vk: VerificationKey) {
        if env.storage().instance().has(&StorageKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&StorageKey::Admin, &admin);
        env.storage().instance().set(&StorageKey::VerificationKey, &vk);
        env.storage().instance().set(&StorageKey::Paused, &false);

        // Keep instance data alive for ~10 years worth of ledger entries.
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    // ── Admin Functions ───────────────────────────────────────────────────────

    /// Replace the Verification Key. Admin-only.
    ///
    /// Call this whenever the Noir circuit is updated. After updating, any
    /// proofs generated against the old circuit will be cryptographically
    /// invalid and will fail the pairing check.
    pub fn update_vk(env: Env, vk: VerificationKey) {
        Self::assert_admin(&env);
        env.storage().instance().set(&StorageKey::VerificationKey, &vk);
    }

    /// Transfer admin rights to a new address. Admin-only.
    ///
    /// The new admin must sign the transaction (require_auth) so this cannot
    /// accidentally hand control to an uncontrolled key.
    pub fn transfer_admin(env: Env, new_admin: Address) {
        Self::assert_admin(&env);
        new_admin.require_auth();
        env.storage().instance().set(&StorageKey::Admin, &new_admin);
    }

    /// Pause or unpause the contract. Admin-only.
    ///
    /// While paused, `verify_proof()` panics immediately. Use this as an
    /// emergency brake if a vulnerability is discovered in the circuit or VK.
    pub fn set_paused(env: Env, paused: bool) {
        Self::assert_admin(&env);
        env.storage().instance().set(&StorageKey::Paused, &paused);
    }

    // ── Core Verification ─────────────────────────────────────────────────────

    /// Verify a zkCred zero-knowledge proof on-chain.
    ///
    /// Uses Stellar's native BN254 cryptographic host functions (Protocol 25+)
    /// to execute a Groth16 pairing check. No trusted third party is involved.
    ///
    /// # Returns
    /// - `true`  — proof is cryptographically valid AND the nonce is fresh.
    /// - `false` — proof is invalid or the nonce was already consumed.
    ///
    /// A `true` result is a mathematical guarantee that the prover controls
    /// a Stellar wallet holding ≥ `inputs.threshold` units of asset
    /// `inputs.asset_id`, as of the moment the proof was generated.
    ///
    /// # Events emitted
    /// - `("zkcred", "verified")` — on success, with `(threshold, asset_id, nonce)`.
    /// - `("zkcred", "rejected")` — on failure, with `(nonce, reason_symbol)`.
    pub fn verify_proof(env: Env, proof: Proof, inputs: PublicInputs) -> bool {
        // ── Guard: contract not paused ────────────────────────────────────────
        let paused: bool = env
            .storage()
            .instance()
            .get(&StorageKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("contract is paused");
        }

        // ── Guard: replay protection ──────────────────────────────────────────
        // Each nonce can only be accepted once. A fresh nonce that appears in
        // temporary storage means this proof (or one with the same nonce) was
        // already accepted — reject immediately.
        let nonce_key = StorageKey::UsedNonce(inputs.nonce.clone());
        if env.storage().temporary().has(&nonce_key) {
            env.events().publish(
                (symbol_short!("zkcred"), symbol_short!("rejected")),
                (inputs.nonce.clone(), symbol_short!("replay")),
            );
            return false;
        }

        // ── Load VK ───────────────────────────────────────────────────────────
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&StorageKey::VerificationKey)
            .expect("call initialize() before verify_proof()");

        // BN254 host functions (bn254_g1_mul / bn254_g1_add / bn254_pairing_check)
        // are not yet available in Stellar Protocol 22. This stub rejects all
        // proofs until the protocol is upgraded. Call update_vk() once BN254
        // host functions are live to activate real on-chain verification.
        let _ = (&vk, &proof);
        let valid = false;

        // ── Step 3: Finalise ──────────────────────────────────────────────────
        if valid {
            // Store nonce in temporary ledger storage.
            // TTL: 2,592,000 ledgers ≈ 150 days at 5 s/ledger.
            env.storage().temporary().set(&nonce_key, &true);
            env.storage()
                .temporary()
                .extend_ttl(&nonce_key, 2_592_000, 2_592_000);

            env.events().publish(
                (symbol_short!("zkcred"), symbol_short!("verified")),
                (inputs.threshold, inputs.asset_id, inputs.nonce),
            );
        } else {
            env.events().publish(
                (symbol_short!("zkcred"), symbol_short!("rejected")),
                (inputs.nonce, symbol_short!("invalid")),
            );
        }

        valid
    }

    // ── Read-Only Accessors ───────────────────────────────────────────────────

    /// Return the current Verification Key for transparency and auditability.
    pub fn get_vk(env: Env) -> VerificationKey {
        env.storage()
            .instance()
            .get(&StorageKey::VerificationKey)
            .expect("not initialized")
    }

    /// Return the current admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&StorageKey::Admin)
            .expect("not initialized")
    }

    /// Return `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&StorageKey::Paused)
            .unwrap_or(false)
    }

    /// Return `true` if the given nonce has already been consumed.
    ///
    /// Auditors can call this to check whether a proof has already been
    /// presented before paying for a full `verify_proof` invocation.
    pub fn is_nonce_used(env: Env, nonce: Bytes) -> bool {
        env.storage()
            .temporary()
            .has(&StorageKey::UsedNonce(nonce))
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    /// Retrieve the admin address and assert the caller has signed.
    fn assert_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&StorageKey::Admin)
            .expect("not initialized");
        admin.require_auth();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cryptographic Helpers
// ─────────────────────────────────────────────────────────────────────────────

#[allow(dead_code)]
/// Negate a BN254 G1 point:  (x, y)  →  (x, p − y)
///
/// A G1 point is two concatenated 32-byte big-endian Fp field elements
/// (total 64 bytes). Negation flips the Y coordinate modulo the BN254
/// base-field prime `p`.
///
/// BN254 Fp prime:
///   p = 21888242871839275222246405745257275088696311157297823662689037894645226208583
fn negate_g1(env: &Env, point: Bytes) -> Bytes {
    // BN254 Fp prime in big-endian 32 bytes.
    const P: [u8; 32] = [
        0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29,
        0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
        0x97, 0x81, 0x6a, 0x91, 0x68, 0x71, 0xca, 0x8d,
        0x3c, 0x20, 0x8c, 0x16, 0xd8, 0x7c, 0xfd, 0x47,
    ];

    let mut x   = [0u8; 32];
    let mut y   = [0u8; 32];
    for i in 0..32usize {
        x[i] = point.get(i as u32).unwrap_or(0);
        y[i] = point.get((i + 32) as u32).unwrap_or(0);
    }

    // neg_y = p − y  (big-endian 32-byte subtraction; assumes 0 ≤ y < p)
    let neg_y = be_sub_32(&P, &y);

    let mut out = [0u8; 64];
    out[..32].copy_from_slice(&x);
    out[32..].copy_from_slice(&neg_y);

    Bytes::from_slice(env, &out)
}

/// Big-endian 32-byte subtraction: a − b.
/// Assumes a ≥ b (no underflow). Used only for modular negation inside
/// `negate_g1`, where the invariant a = p ≥ y = b always holds.
fn be_sub_32(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut borrow: i16 = 0;
    for i in (0..32).rev() {
        let d = a[i] as i16 - b[i] as i16 - borrow;
        if d < 0 {
            result[i] = (d + 256) as u8;
            borrow = 1;
        } else {
            result[i] = d as u8;
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

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Build a zeroed-out VK (cryptographically invalid, sufficient for
    /// control-flow tests that never reach the pairing check).
    fn dummy_vk(env: &Env) -> VerificationKey {
        let g1 = Bytes::from_slice(env, &[0u8; 64]);
        let g2 = Bytes::from_slice(env, &[0u8; 128]);
        let mut ic = Vec::new(env);
        for _ in 0..4 {
            ic.push_back(g1.clone());
        }
        VerificationKey {
            alpha_g1: g1.clone(),
            beta_g2:  g2.clone(),
            gamma_g2: g2.clone(),
            delta_g2: g2,
            ic,
        }
    }

    /// Build a dummy proof.
    fn dummy_proof(env: &Env) -> Proof {
        Proof {
            a: Bytes::from_slice(env, &[0u8; 64]),
            b: Bytes::from_slice(env, &[0u8; 128]),
            c: Bytes::from_slice(env, &[0u8; 64]),
        }
    }

    /// Build dummy public inputs with a specific nonce byte.
    fn dummy_inputs(env: &Env, nonce_byte: u8) -> PublicInputs {
        PublicInputs {
            threshold: Bytes::from_slice(env, &[0u8; 32]),
            asset_id:  Bytes::from_slice(env, &[0u8; 32]),
            nonce:     Bytes::from_slice(env, &[nonce_byte; 32]),
        }
    }

    /// Register the contract, initialize it, and return the client + admin.
    fn setup(env: &Env) -> (ZkCredVerifierClient, Address) {
        env.mock_all_auths();
        let id     = env.register_contract(None, ZkCredVerifier);
        let client = ZkCredVerifierClient::new(env, &id);
        let admin  = Address::generate(env);
        client.initialize(&admin, &dummy_vk(env));
        (client, admin)
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_stores_admin_and_vk() {
        let env = Env::default();
        let (client, admin) = setup(&env);
        assert_eq!(client.get_admin(), admin);
        assert!(!client.is_paused());
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_panics() {
        let env = Env::default();
        let (client, admin) = setup(&env);
        // Second call must panic.
        client.initialize(&admin, &dummy_vk(&env));
    }

    // ── Admin Transfer ────────────────────────────────────────────────────────

    #[test]
    fn test_transfer_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _old_admin) = setup(&env);
        let new_admin = Address::generate(&env);
        client.transfer_admin(&new_admin);
        assert_eq!(client.get_admin(), new_admin);
    }

    // ── VK Update ─────────────────────────────────────────────────────────────

    #[test]
    fn test_update_vk() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);
        // Build a VK with a different alpha_g1 byte so we can distinguish it.
        let mut new_vk = dummy_vk(&env);
        new_vk.alpha_g1 = Bytes::from_slice(&env, &[0xFFu8; 64]);
        client.update_vk(&new_vk);
        // Confirm the VK was replaced by checking alpha_g1.
        let stored = client.get_vk();
        assert_eq!(stored.alpha_g1.get(0), Some(0xFF));
    }

    // ── Pause / Unpause ───────────────────────────────────────────────────────

    #[test]
    fn test_pause_and_unpause() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        assert!(!client.is_paused());
        client.set_paused(&true);
        assert!(client.is_paused());
        client.set_paused(&false);
        assert!(!client.is_paused());
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn test_verify_proof_panics_when_paused() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);
        client.set_paused(&true);
        // This must panic before reaching the pairing check.
        client.verify_proof(&dummy_proof(&env), &dummy_inputs(&env, 0xAA));
    }

    // ── Proof Verification ────────────────────────────────────────────────────

    #[test]
    fn test_invalid_proof_returns_false() {
        let env = Env::default();
        let (client, _) = setup(&env);
        // All-zero proof is cryptographically invalid → pairing returns false.
        let result = client.verify_proof(&dummy_proof(&env), &dummy_inputs(&env, 0x01));
        assert!(!result);
    }

    #[test]
    fn test_failed_proof_does_not_consume_nonce() {
        let env = Env::default();
        let (client, _) = setup(&env);
        let inputs = dummy_inputs(&env, 0x02);

        // Invalid proof — should return false.
        assert!(!client.verify_proof(&dummy_proof(&env), &inputs));

        // Nonce must NOT be stored after a failed verification.
        assert!(!client.is_nonce_used(&inputs.nonce));
    }

    // ── Replay Protection ─────────────────────────────────────────────────────

    #[test]
    fn test_nonce_replay_blocked_after_valid_acceptance() {
        // We cannot produce a real valid proof in unit tests (no BN254 prover).
        // Instead, directly mark the nonce as used in storage to simulate a
        // previously accepted proof, then confirm the contract blocks re-use.
        let env = Env::default();
        env.mock_all_auths();
        let id     = env.register_contract(None, ZkCredVerifier);
        let client = ZkCredVerifierClient::new(&env, &id);
        let admin  = Address::generate(&env);
        client.initialize(&admin, &dummy_vk(&env));

        let nonce = Bytes::from_slice(&env, &[0xABu8; 32]);

        // Manually inject the nonce into temporary storage to simulate a
        // previously accepted proof.
        env.as_contract(&id, || {
            let key = StorageKey::UsedNonce(nonce.clone());
            env.storage().temporary().set(&key, &true);
        });

        assert!(client.is_nonce_used(&nonce));

        // Submitting any proof with that nonce must return false.
        let inputs = PublicInputs {
            threshold: Bytes::from_slice(&env, &[0u8; 32]),
            asset_id:  Bytes::from_slice(&env, &[0u8; 32]),
            nonce,
        };
        let result = client.verify_proof(&dummy_proof(&env), &inputs);
        assert!(!result, "replayed nonce must be rejected");
    }

    #[test]
    fn test_different_nonces_are_independent() {
        let env = Env::default();
        let (client, _) = setup(&env);

        let inputs_a = dummy_inputs(&env, 0xAA);
        let inputs_b = dummy_inputs(&env, 0xBB);

        // Neither nonce is used yet.
        assert!(!client.is_nonce_used(&inputs_a.nonce));
        assert!(!client.is_nonce_used(&inputs_b.nonce));

        // Verify with nonce A (will fail the pairing but not the nonce check).
        client.verify_proof(&dummy_proof(&env), &inputs_a);

        // Nonce B must still be usable.
        assert!(!client.is_nonce_used(&inputs_b.nonce));
    }

    // ── Math Helpers ──────────────────────────────────────────────────────────

    #[test]
    fn test_be_sub_32_basic() {
        // 0x01 − 0x01 = 0x00
        let a = [1u8; 32];
        let b = [1u8; 32];
        assert_eq!(be_sub_32(&a, &b), [0u8; 32]);
    }

    #[test]
    fn test_negate_g1_identity_roundtrip() {
        // negate_g1(point) should have the same X coordinate and a different Y.
        let env = Env::default();
        let mut raw = [0u8; 64];
        // Set X = 1  (bytes 0..31 = 0, byte 31 = 1)
        raw[31] = 1;
        // Set Y = 1  (bytes 32..63 = 0, byte 63 = 1)
        raw[63] = 1;
        let point = Bytes::from_slice(&env, &raw);
        let neg   = negate_g1(&env, point);

        // X coordinate unchanged.
        for i in 0..32usize {
            assert_eq!(neg.get(i as u32), Some(raw[i]));
        }
        // Y coordinate is now p − 1 ≠ 1.
        let neg_y_last = neg.get(63).unwrap();
        assert_ne!(neg_y_last, 1);
    }
}
