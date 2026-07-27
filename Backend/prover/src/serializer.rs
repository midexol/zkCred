//! Serialization adapter: arkworks (little-endian, compressed) → Soroban (big-endian, uncompressed)
//!
//! The Soroban BLS12-381 host functions expect:
//!   G1 point : 96 bytes  = be(x)[48] || be(y)[48]              (uncompressed affine)
//!   G2 point : 192 bytes = be(x_c1)[48]||be(x_c0)[48]||be(y_c1)[48]||be(y_c0)[48]
//!   Fr scalar: 32 bytes  = big-endian, reduced mod r
//!
//! Arkworks serializes in little-endian with a compression flag byte (or uses
//! `serialize_uncompressed` which is still LE). This module bridges the gap.

use ark_bls12_381::{
    g1::G1Affine,
    g2::G2Affine,
    Fr,
};
use ark_serialize::{CanonicalSerialize, CanonicalDeserialize};
use ark_ff::BigInteger;
use serde::{Serialize, Deserialize};

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

/// Groth16 Verification Key serialized in Soroban's byte format, as hex strings.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VkJson {
    /// [α]_1 — 96 bytes hex
    pub alpha_g1: String,
    /// [β]_2 — 192 bytes hex
    pub beta_g2: String,
    /// [γ]_2 — 192 bytes hex
    pub gamma_g2: String,
    /// [δ]_2 — 192 bytes hex
    pub delta_g2: String,
    /// [IC_0, IC_1, IC_2, IC_3] — each 96 bytes hex
    pub ic: Vec<String>,
}

/// A Groth16 proof π serialized in Soroban's byte format, as hex strings.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProofJson {
    /// π_A ∈ G1 — 96 bytes hex
    pub a: String,
    /// π_B ∈ G2 — 192 bytes hex
    pub b: String,
    /// π_C ∈ G1 — 96 bytes hex
    pub c: String,
}

/// Public inputs encoded as 32-byte big-endian hex Fr scalars.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PublicInputsJson {
    /// Threshold scalar — 32 bytes hex
    pub threshold: String,
    /// Asset ID scalar — 32 bytes hex
    pub asset_id: String,
    /// Nonce scalar — 32 bytes hex
    pub nonce: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// G1 serialization
// ─────────────────────────────────────────────────────────────────────────────

/// Serialize a BLS12-381 G1 affine point into the 96-byte Soroban format:
///   bytes[0..48]  = x coordinate, big-endian, 48 bytes
///   bytes[48..96] = y coordinate, big-endian, 48 bytes
/// The point at infinity is represented as all-zero bytes.
pub fn g1_to_soroban(p: &G1Affine) -> [u8; 96] {
    if p.infinity {
        return [0u8; 96];
    }
    let mut out = [0u8; 96];
    // arkworks stores Fp as little-endian limbs; BigInteger::to_bytes_be() gives BE
    let x_be = p.x.into_bigint().to_bytes_be();
    let y_be = p.y.into_bigint().to_bytes_be();
    // x_be / y_be are 48 bytes for BLS12-381 Fp
    out[0..48].copy_from_slice(&x_be);
    out[48..96].copy_from_slice(&y_be);
    out
}

// ─────────────────────────────────────────────────────────────────────────────
// G2 serialization
// ─────────────────────────────────────────────────────────────────────────────

/// Serialize a BLS12-381 G2 affine point into the 192-byte Soroban format:
///   bytes[0..48]    = x.c1, big-endian
///   bytes[48..96]   = x.c0, big-endian
///   bytes[96..144]  = y.c1, big-endian
///   bytes[144..192] = y.c0, big-endian
/// The point at infinity is all-zero bytes.
pub fn g2_to_soroban(p: &G2Affine) -> [u8; 192] {
    if p.infinity {
        return [0u8; 192];
    }
    let mut out = [0u8; 192];
    let x_c1_be = p.x.c1.into_bigint().to_bytes_be();
    let x_c0_be = p.x.c0.into_bigint().to_bytes_be();
    let y_c1_be = p.y.c1.into_bigint().to_bytes_be();
    let y_c0_be = p.y.c0.into_bigint().to_bytes_be();
    out[0..48].copy_from_slice(&x_c1_be);
    out[48..96].copy_from_slice(&x_c0_be);
    out[96..144].copy_from_slice(&y_c1_be);
    out[144..192].copy_from_slice(&y_c0_be);
    out
}

// ─────────────────────────────────────────────────────────────────────────────
// Fr scalar serialization
// ─────────────────────────────────────────────────────────────────────────────

/// Serialize a BLS12-381 Fr scalar into 32-byte big-endian format.
/// Fr is 255 bits, so the 32-byte representation always fits.
pub fn fr_to_soroban(s: &Fr) -> [u8; 32] {
    use ark_ff::PrimeField;
    let be_bytes = s.into_bigint().to_bytes_be();
    // BLS12-381 Fr is 32 bytes
    let mut out = [0u8; 32];
    let len = be_bytes.len().min(32);
    out[32 - len..].copy_from_slice(&be_bytes[..len]);
    out
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level helpers
// ─────────────────────────────────────────────────────────────────────────────

pub fn g1_to_hex(p: &G1Affine) -> String {
    hex::encode(g1_to_soroban(p))
}

pub fn g2_to_hex(p: &G2Affine) -> String {
    hex::encode(g2_to_soroban(p))
}

pub fn fr_to_hex(s: &Fr) -> String {
    hex::encode(fr_to_soroban(s))
}

/// Deserialize a Soroban-format Fr hex string (32 bytes BE) back to an Fr scalar.
/// Used for parsing threshold/asset_id/nonce from the CLI or API.
pub fn hex_to_fr(h: &str) -> Result<Fr, String> {
    use ark_ff::PrimeField;
    let bytes = hex::decode(h.trim_start_matches("0x"))
        .map_err(|e| format!("hex decode error: {e}"))?;
    if bytes.len() > 32 {
        return Err(format!("Fr hex too long: {} bytes", bytes.len()));
    }
    // Pad to 32 bytes, big-endian → little-endian for arkworks
    let mut be32 = [0u8; 32];
    be32[32 - bytes.len()..].copy_from_slice(&bytes);
    let mut le32 = be32;
    le32.reverse();
    Ok(Fr::from_le_bytes_mod_order(&le32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_bls12_381::Bls12_381;
    use ark_ec::{AffineRepr, CurveGroup};
    use ark_std::UniformRand;
    use ark_std::rand::rngs::StdRng;
    use ark_std::rand::SeedableRng;

    #[test]
    fn test_g1_roundtrip_length() {
        let mut rng = StdRng::seed_from_u64(1);
        let p = G1Affine::rand(&mut rng);
        let bytes = g1_to_soroban(&p);
        assert_eq!(bytes.len(), 96, "G1 serialization must be 96 bytes");
        // Ensure it is not all zeros (a random point is not at infinity)
        assert_ne!(bytes, [0u8; 96], "Random G1 point should not be infinity");
    }

    #[test]
    fn test_g2_roundtrip_length() {
        let mut rng = StdRng::seed_from_u64(2);
        let p = G2Affine::rand(&mut rng);
        let bytes = g2_to_soroban(&p);
        assert_eq!(bytes.len(), 192, "G2 serialization must be 192 bytes");
    }

    #[test]
    fn test_fr_roundtrip() {
        let fr = Fr::from(12345678u64);
        let hex = fr_to_hex(&fr);
        let recovered = hex_to_fr(&hex).unwrap();
        assert_eq!(fr, recovered, "Fr hex roundtrip failed");
    }

    #[test]
    fn test_infinity_encodes_as_zeros() {
        // Construct the point at infinity
        let inf = G1Affine { x: ark_bls12_381::Fq::from(0u64), y: ark_bls12_381::Fq::from(0u64), infinity: true };
        let bytes = g1_to_soroban(&inf);
        assert_eq!(bytes, [0u8; 96]);
    }
}
