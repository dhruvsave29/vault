use anchor_lang::prelude::*;

#[account]
pub struct Reputation {
    pub bump: u8,
    pub model: Pubkey,
    pub score: u32,
    pub total_inferences: u64,
    pub successful_inferences: u64,
    pub failed_inferences: u64,
    pub avg_inference_time_ms: u32,
    pub last_updated: i64,
}
