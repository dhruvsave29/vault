use anchor_lang::prelude::*;

#[account]
pub struct ComputeNode {
    pub bump: u8,
    pub node_address: Pubkey,
    pub endpoint_url: String,
    pub stake: u64,
    pub inference_count: u64,
    pub total_inference_time_ms: u64,
    pub uptime_score: u32,
    pub reputation: u32,
    pub tee_attestation_hash: [u8; 32],
    pub supported_task_types: u16,
    pub max_model_size_kb: u32,
    pub is_active: bool,
    pub registered_at: i64,
    pub last_heartbeat: i64,
    pub accumulated_revenue: u64,
}
