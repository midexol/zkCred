//! zkCred R1CS Circuit — Balance Threshold Proof
//!
//! This circuit encodes two constraints that mirror the Noir circuit in
//! `Backend/circuits/src/main.nr`:
//!
//!   1. `balance >= threshold`  — the core ZK claim
//!   2. `balance <= SANITY_CAP` — prevents impossible-large balance attacks
//!
//! Public inputs visible to the verifier:
//!   - `threshold` (u64 → Fr)   : the minimum balance being claimed
//!   - `asset_id`  (Fr)         : field-element identifier for the asset
//!   - `nonce`     (Fr)         : per-proof replay-guard random value
//!
//! Private witness (stays on the prover's machine):
//!   - `balance`   (u64 → Fr)   : actual wallet balance in micro-units

use ark_bls12_381::Fr;
use ark_r1cs_std::{
    alloc::AllocVar,
    fields::fp::FpVar,
    prelude::{Boolean, EqGadget, FieldVar},
    R1CSVar,
};
use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystemRef, SynthesisError};
use ark_ff::{Field, PrimeField, BigInteger};
use std::ops::Sub;

/// 1 quadrillion micro-units — far above any realistic balance, below u64::MAX.
pub const SANITY_CAP: u64 = 1_000_000_000_000_000u64;

/// The number of public inputs (threshold, asset_id, nonce).
pub const NUM_PUBLIC_INPUTS: usize = 3;

/// The zkCred balance-threshold R1CS circuit.
#[derive(Clone)]
pub struct BalanceCircuit {
    // ── Private witness ──────────────────────────────────────────────────────
    /// Actual wallet balance in micro-units (e.g. $42,318.96 USDC = 42_318_960_000).
    pub balance: u64,

    // ── Public inputs ────────────────────────────────────────────────────────
    /// Minimum balance the prover claims to hold (e.g. $5,000 = 5_000_000_000).
    pub threshold: u64,
    /// Field-element identifier for the asset being proven (e.g. hash of "USDC").
    pub asset_id: Fr,
    /// Unique per-proof nonce; the on-chain verifier records used nonces.
    pub nonce: Fr,
}

impl ConstraintSynthesizer<Fr> for BalanceCircuit {
    fn generate_constraints(self, cs: ConstraintSystemRef<Fr>) -> Result<(), SynthesisError> {
        // ── Allocate private witness ─────────────────────────────────────────
        let balance_var = FpVar::new_witness(cs.clone(), || {
            Ok(Fr::from(self.balance))
        })?;

        // ── Allocate public inputs ───────────────────────────────────────────
        //
        // NOTE: The order here defines the order in the public input vector
        // [threshold, asset_id, nonce] — the Soroban verifier's IC array
        // must be generated in the same order by the trusted setup.
        let threshold_var = FpVar::new_input(cs.clone(), || Ok(Fr::from(self.threshold)))?;
        let _asset_id_var = FpVar::new_input(cs.clone(), || Ok(self.asset_id))?;
        let _nonce_var    = FpVar::new_input(cs.clone(), || Ok(self.nonce))?;

        // ── Constraint 1: balance >= threshold ───────────────────────────────
        //
        // Encoded as: balance - threshold >= 0
        // We enforce this via a bit-decomposition of (balance - threshold).
        // If balance < threshold, the subtraction wraps mod r (field prime)
        // and the bit count would exceed 64 bits — the constraint fails.
        //
        // Approach: enforce that `diff = balance - threshold` fits in 64 bits.
        let diff_var = balance_var.clone().sub(&threshold_var);
        // Enforce the difference lies in [0, 2^64) by checking bit length.
        enforce_64bit_range(cs.clone(), &diff_var)?;

        // ── Constraint 2: balance <= SANITY_CAP ──────────────────────────────
        //
        // cap - balance >= 0, enforced by bit decomposition.
        let cap_var = FpVar::new_constant(cs.clone(), Fr::from(SANITY_CAP))?;
        let cap_diff_var = cap_var.sub(&balance_var);
        enforce_64bit_range(cs.clone(), &cap_diff_var)?;

        Ok(())
    }
}

/// Enforce that a field element `x` represents a value in [0, 2^64).
///
/// We compute the 64-bit decomposition of `x` and reconstruct it,
/// then assert the reconstruction equals `x`. If `x` is negative
/// (i.e. it wraps mod the field prime), the decomposition into 64
/// bits will not reconstruct the original value, so the constraint fails.
fn enforce_64bit_range(
    cs: ConstraintSystemRef<Fr>,
    x: &FpVar<Fr>,
) -> Result<(), SynthesisError> {
    let bits = x.to_bits_le()?;
    // We only need 64 bits. Reconstruct from the lower 64 bits and enforce equality.
    let bits_64 = &bits[..64.min(bits.len())];
    let mut reconstructed = FpVar::zero();
    let mut coeff = Fr::one();
    for bit in bits_64 {
        let bit_fp = FpVar::from(bit.clone());
        reconstructed += bit_fp * FpVar::constant(coeff);
        coeff.double_in_place();
    }
    reconstructed.enforce_equal(x)?;
    Ok(())
}

/// Construct a `BalanceCircuit` with placeholder (zero) witnesses
/// for use during trusted setup (no real private inputs needed).
pub fn placeholder_circuit() -> BalanceCircuit {
    BalanceCircuit {
        balance:   0,
        threshold: 0,
        asset_id:  Fr::from(0u64),
        nonce:     Fr::from(0u64),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_bls12_381::Bls12_381;
    use ark_groth16::Groth16;
    use ark_snark::SNARK;
    use ark_std::rand::{rngs::StdRng, SeedableRng};

    /// Generate a real proof and verify it with the local verifier.
    #[test]
    fn test_valid_proof_verifies() {
        let mut rng = StdRng::seed_from_u64(42);

        // Trusted setup
        let circuit = placeholder_circuit();
        let (pk, vk) = Groth16::<Bls12_381>::circuit_specific_setup(circuit, &mut rng)
            .expect("Setup failed");

        // Prove: balance $42k >= threshold $5k
        let proving_circuit = BalanceCircuit {
            balance:   42_318_960_000u64,
            threshold: 5_000_000_000u64,
            asset_id:  Fr::from(0x14f0d1c0u64),
            nonce:     Fr::from(0x3a7c9f2du64),
        };
        let public_inputs = vec![
            Fr::from(proving_circuit.threshold),
            proving_circuit.asset_id,
            proving_circuit.nonce,
        ];

        let proof = Groth16::<Bls12_381>::prove(&pk, proving_circuit.clone(), &mut rng)
            .expect("Prove failed");

        let valid = Groth16::<Bls12_381>::verify(&vk, &public_inputs, &proof)
            .expect("Verify failed");
        assert!(valid, "Valid proof must verify");
    }

    /// A proof that doesn't satisfy the threshold must fail.
    #[test]
    fn test_invalid_proof_rejected() {
        let mut rng = StdRng::seed_from_u64(99);

        let circuit = placeholder_circuit();
        let (pk, vk) = Groth16::<Bls12_381>::circuit_specific_setup(circuit, &mut rng)
            .expect("Setup failed");

        // balance < threshold — constraint synthesis should fail (panic/err)
        let bad_circuit = BalanceCircuit {
            balance:   1_000_000u64,       // $1 USDC
            threshold: 5_000_000_000u64,   // $5000 USDC
            asset_id:  Fr::from(0u64),
            nonce:     Fr::from(1u64),
        };

        // prove() should return an error because constraint system is unsatisfied
        let result = Groth16::<Bls12_381>::prove(&pk, bad_circuit, &mut rng);
        assert!(result.is_err(), "Proof for balance < threshold should fail");
    }
}
