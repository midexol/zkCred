//! zkCred Prover — CLI entry point
//!
//! Three modes:
//!   `zkcred-prover setup`             — Groth16 trusted setup → vk.json + proving_key.bin
//!   `zkcred-prover prove [OPTIONS]`   — Generate a proof → proof.json
//!   `zkcred-prover serve`             — Local HTTP API for the frontend (port 3001)

mod circuit;
mod serializer;

use circuit::{BalanceCircuit, placeholder_circuit, NUM_PUBLIC_INPUTS};
use serializer::{
    VkJson, ProofJson, PublicInputsJson,
    g1_to_hex, g2_to_hex, fr_to_hex, hex_to_fr,
};

use ark_bls12_381::{Bls12_381, Fr, G1Affine, G2Affine};
use ark_groth16::{Groth16, ProvingKey, VerifyingKey};
use ark_serialize::{CanonicalSerialize, CanonicalDeserialize};
use ark_snark::SNARK;
use ark_ff::PrimeField;
use ark_std::rand::{rngs::StdRng, SeedableRng};
use clap::{Parser, Subcommand};
use serde::{Serialize, Deserialize};
use std::{fs, path::PathBuf};

// ─────────────────────────────────────────────────────────────────────────────
// CLI definition
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
#[command(name = "zkcred-prover", about = "zkCred BLS12-381 Groth16 prover", version)]
struct Cli {
    #[command(subcommand)]
    command: Command,

    /// Directory for output files (default: current directory)
    #[arg(long, default_value = ".")]
    out_dir: PathBuf,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Run Groth16 trusted setup; outputs vk.json and proving_key.bin
    Setup {
        /// Deterministic seed for reproducible setups (0 = random)
        #[arg(long, default_value_t = 0)]
        seed: u64,
    },

    /// Generate a proof from private balance and public inputs
    Prove {
        /// Private balance in micro-units (e.g. 42318960000 for $42,318.96 USDC)
        #[arg(long)]
        balance: u64,

        /// Public threshold in micro-units (e.g. 5000000000 for $5,000 USDC)
        #[arg(long)]
        threshold: u64,

        /// Public asset_id as big-endian hex Fr scalar (32 bytes)
        #[arg(long, default_value = "0000000000000000000000000000000000000000000000000000000000000001")]
        asset_id: String,

        /// Public nonce as big-endian hex Fr scalar (32 bytes, must be unique per submission)
        #[arg(long)]
        nonce: Option<String>,

        /// Path to proving_key.bin (default: out_dir/proving_key.bin)
        #[arg(long)]
        pk_path: Option<PathBuf>,
    },

    /// Start local HTTP API on localhost:3001 for frontend integration
    Serve {
        #[arg(long, default_value_t = 3001)]
        port: u16,

        /// Path to proving_key.bin to load at startup
        #[arg(long)]
        pk_path: Option<PathBuf>,
    },
}

// ─────────────────────────────────────────────────────────────────────────────
// Trusted setup
// ─────────────────────────────────────────────────────────────────────────────

fn cmd_setup(out_dir: &PathBuf, seed: u64) -> anyhow::Result<()> {
    use ark_std::test_rng;

    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!(" zkCred — Groth16 Trusted Setup (BLS12-381)");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!();
    println!("→ Circuit: BalanceThreshold (3 public inputs, 1 private)");

    let mut rng: StdRng = if seed == 0 {
        StdRng::from_entropy()
    } else {
        StdRng::seed_from_u64(seed)
    };

    println!("→ Running Groth16 circuit-specific setup…");
    let circuit = placeholder_circuit();
    let (pk, vk) = Groth16::<Bls12_381>::circuit_specific_setup(circuit, &mut rng)
        .map_err(|e| anyhow::anyhow!("Setup failed: {e:?}"))?;

    println!("✓ Setup complete.");

    // ── Serialize VK → vk.json ───────────────────────────────────────────────
    let pvk = ark_groth16::prepare_verifying_key(&vk);

    // IC points: [IC_0 (constant), IC_1 (threshold), IC_2 (asset_id), IC_3 (nonce)]
    let ic_hex: Vec<String> = vk.gamma_abc_g1.iter().map(g1_to_hex).collect();

    let vk_json = VkJson {
        alpha_g1: g1_to_hex(&vk.alpha_g1),
        beta_g2:  g2_to_hex(&vk.beta_g2),
        gamma_g2: g2_to_hex(&vk.gamma_g2),
        delta_g2: g2_to_hex(&vk.delta_g2),
        ic: ic_hex,
    };

    let vk_path = out_dir.join("vk.json");
    fs::write(&vk_path, serde_json::to_string_pretty(&vk_json)?)?;
    println!("✓ VK written → {}", vk_path.display());
    println!("  alpha_g1: {}…", &vk_json.alpha_g1[..16]);
    println!("  IC points: {}", vk_json.ic.len());

    // ── Serialize PK → proving_key.bin ──────────────────────────────────────
    let pk_path = out_dir.join("proving_key.bin");
    let mut pk_bytes = Vec::new();
    pk.serialize_uncompressed(&mut pk_bytes)
        .map_err(|e| anyhow::anyhow!("PK serialize: {e:?}"))?;
    fs::write(&pk_path, &pk_bytes)?;
    println!("✓ Proving key written → {} ({} KB)", pk_path.display(), pk_bytes.len() / 1024);

    println!();
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!(" NEXT: deploy the contract and initialize with vk.json");
    println!("   bash Backend/scripts/3_deploy_contract.sh");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Core proving logic (shared between CLI and HTTP API)
// ─────────────────────────────────────────────────────────────────────────────

fn load_proving_key(path: &PathBuf) -> anyhow::Result<ProvingKey<Bls12_381>> {
    let bytes = fs::read(path)
        .map_err(|e| anyhow::anyhow!("Could not read {}: {e}", path.display()))?;
    ProvingKey::deserialize_uncompressed(&*bytes)
        .map_err(|e| anyhow::anyhow!("PK deserialize: {e:?}"))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProveOutput {
    pub proof: ProofJson,
    pub public_inputs: PublicInputsJson,
}

fn prove(
    pk: &ProvingKey<Bls12_381>,
    balance: u64,
    threshold: u64,
    asset_id: Fr,
    nonce: Fr,
) -> anyhow::Result<ProveOutput> {
    let mut rng = StdRng::from_entropy();

    let circuit = BalanceCircuit { balance, threshold, asset_id, nonce };

    let ark_proof = Groth16::<Bls12_381>::prove(pk, circuit, &mut rng)
        .map_err(|e| anyhow::anyhow!("Prove failed: {e:?}"))?;

    let proof_json = ProofJson {
        a: g1_to_hex(&ark_proof.a),
        b: g2_to_hex(&ark_proof.b),
        c: g1_to_hex(&ark_proof.c),
    };

    let public_inputs_json = PublicInputsJson {
        threshold: fr_to_hex(&Fr::from(threshold)),
        asset_id:  fr_to_hex(&asset_id),
        nonce:     fr_to_hex(&nonce),
    };

    Ok(ProveOutput {
        proof: proof_json,
        public_inputs: public_inputs_json,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI: prove subcommand
// ─────────────────────────────────────────────────────────────────────────────

fn cmd_prove(
    out_dir: &PathBuf,
    balance: u64,
    threshold: u64,
    asset_id_hex: &str,
    nonce_hex: Option<&str>,
    pk_path_override: Option<&PathBuf>,
) -> anyhow::Result<()> {
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!(" zkCred — Generating Groth16 Proof");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("→ balance   : {}", balance);
    println!("→ threshold : {}", threshold);

    if balance < threshold {
        return Err(anyhow::anyhow!(
            "balance ({}) < threshold ({}) — constraint will not be satisfied",
            balance, threshold
        ));
    }

    let pk_path = pk_path_override
        .cloned()
        .unwrap_or_else(|| out_dir.join("proving_key.bin"));

    println!("→ Loading proving key from {}", pk_path.display());
    let pk = load_proving_key(&pk_path)?;

    let asset_id = hex_to_fr(asset_id_hex)
        .map_err(|e| anyhow::anyhow!("asset_id: {e}"))?;

    // Generate a fresh random nonce if none provided
    let nonce = match nonce_hex {
        Some(h) => hex_to_fr(h).map_err(|e| anyhow::anyhow!("nonce: {e}"))?,
        None => {
            use ark_std::UniformRand;
            Fr::rand(&mut StdRng::from_entropy())
        }
    };

    println!("→ Proving… (this takes a few seconds)");
    let output = prove(&pk, balance, threshold, asset_id, nonce)?;

    let proof_path = out_dir.join("proof.json");
    fs::write(&proof_path, serde_json::to_string_pretty(&output)?)?;

    println!("✓ Proof written → {}", proof_path.display());
    println!("  π_A: {}…", &output.proof.a[..16]);
    println!("  nonce: {}", output.public_inputs.nonce);
    println!();
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!(" Share proof.json with the auditor (or paste into");
    println!(" the frontend Auditor tab for on-chain verification).");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP API (serve subcommand)
// ─────────────────────────────────────────────────────────────────────────────

mod api {
    use super::*;
    use actix_cors::Cors;
    use actix_web::{web, App, HttpResponse, HttpServer, Responder};
    use std::sync::Arc;

    pub struct AppState {
        pub pk: ProvingKey<Bls12_381>,
    }

    #[derive(Deserialize, Debug)]
    pub struct ProveRequest {
        /// Private balance in micro-units
        pub balance: u64,
        /// Public threshold in micro-units
        pub threshold: u64,
        /// Public asset_id as BE hex string (32 bytes)
        pub asset_id: String,
        /// Public nonce as BE hex string (32 bytes); omit to auto-generate
        pub nonce: Option<String>,
    }

    /// POST /prove
    /// Body: ProveRequest JSON
    /// Returns: ProveOutput JSON
    async fn prove_endpoint(
        data: web::Data<Arc<AppState>>,
        req: web::Json<ProveRequest>,
    ) -> impl Responder {
        let asset_id = match hex_to_fr(&req.asset_id) {
            Ok(v) => v,
            Err(e) => return HttpResponse::BadRequest().body(format!("asset_id error: {e}")),
        };

        let nonce = match &req.nonce {
            Some(h) => match hex_to_fr(h) {
                Ok(v) => v,
                Err(e) => return HttpResponse::BadRequest().body(format!("nonce error: {e}")),
            },
            None => {
                use ark_std::UniformRand;
                Fr::rand(&mut StdRng::from_entropy())
            }
        };

        match prove(&data.pk, req.balance, req.threshold, asset_id, nonce) {
            Ok(output) => HttpResponse::Ok().json(output),
            Err(e) => HttpResponse::InternalServerError().body(format!("Prove error: {e}")),
        }
    }

    /// GET /health
    async fn health() -> impl Responder {
        HttpResponse::Ok().body("zkCred prover ready")
    }

    pub async fn run(port: u16, pk: ProvingKey<Bls12_381>) -> std::io::Result<()> {
        let state = Arc::new(AppState { pk });

        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        println!(" zkCred Prover API — listening on http://0.0.0.0:{}", port);
        println!(" POST /prove  — generate a proof");
        println!(" GET  /health — liveness check");
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        HttpServer::new(move || {
            let cors = Cors::default()
                .allow_any_origin()
                .allow_any_method()
                .allow_any_header();

            App::new()
                .wrap(cors)
                .app_data(web::Data::new(state.clone()))
                .route("/prove", web::post().to(prove_endpoint))
                .route("/health", web::get().to(health))
        })
        .bind(format!("0.0.0.0:{}", port))?
        .run()
        .await
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Command::Setup { seed } => {
            cmd_setup(&cli.out_dir, seed)?;
        }

        Command::Prove { balance, threshold, asset_id, nonce, pk_path } => {
            cmd_prove(
                &cli.out_dir,
                balance,
                threshold,
                &asset_id,
                nonce.as_deref(),
                pk_path.as_ref(),
            )?;
        }

        Command::Serve { port, pk_path } => {
            let path = pk_path.unwrap_or_else(|| cli.out_dir.join("proving_key.bin"));
            println!("→ Loading proving key from {}", path.display());
            let pk = load_proving_key(&path)?;
            println!("✓ Proving key loaded.");
            api::run(port, pk).await?;
        }
    }

    Ok(())
}
