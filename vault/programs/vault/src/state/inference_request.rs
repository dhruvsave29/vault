use anchor_lang::prelude::*;

#[account]
pub struct InferenceRequest {
    pub bump: u8,
    pub requester: Pubkey,
    pub model: Pubkey,
    pub assigned_node: Pubkey,
    pub input_hash: [u8; 32],
    pub output_hash: [u8; 32],
    pub zk_inference_proof: [u8; 32],
    pub payment_amount: u64,
    pub payment_signature: String,
    pub status: u8,
    pub inference_time_ms: u32,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub compute_flops: u64,
    pub memory_peak_kb: u32,
    pub tee_attestation_hash: [u8; 32],
    pub rating: u8,
    pub created_at: i64,
    pub completed_at: i64,
}

pub const STATUS_CREATED: u8 = 0;
pub const STATUS_PAID: u8 = 1;
pub const STATUS_NODE_ASSIGNED: u8 = 2;
pub const STATUS_COMPLETED: u8 = 3;
pub const STATUS_VERIFIED: u8 = 4;
pub const STATUS_DISPUTED: u8 = 5;
