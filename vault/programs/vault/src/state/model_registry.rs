use crate::constants::MAX_CONTRIBUTORS;
use anchor_lang::prelude::*;

#[account]
pub struct ModelRegistry {
    pub bump: u8,
    pub model_id: u64,
    pub owner: Pubkey,
    pub ownership_token_mint: Pubkey,
    pub ipfs_cid: String,
    pub encryption_key_hash: [u8; 32],
    pub model_format: u8,
    pub task_type: u8,
    pub framework_version: String,
    pub accuracy_claim: u16,
    pub zk_accuracy_proof_hash: [u8; 32],
    pub price_per_use: u64,
    pub subscription_price: u64,
    pub is_listed_for_sale: bool,
    pub sale_price: u64,
    pub contributors: Vec<Pubkey>,
    pub contribution_shares: Vec<u16>,
    pub contribution_proofs: Vec<[u8; 32]>,
    pub accumulated_revenue: Vec<u64>,
    pub total_revenue: u64,
    pub inference_count: u64,
    pub reputation_score: u32,
    pub total_ratings: u32,
    pub sum_ratings: u32,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub delegate_validator: Pubkey,
}

impl ModelRegistry {
    pub fn validate_shares(shares: &[u16]) -> bool {
        if shares.len() > MAX_CONTRIBUTORS {
            return false;
        }
        let total: u16 = shares.iter().sum();
        total <= 10000
    }
}
