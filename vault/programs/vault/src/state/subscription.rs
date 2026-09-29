use anchor_lang::prelude::*;

#[account]
pub struct Subscription {
    pub bump: u8,
    pub subscriber: Pubkey,
    pub model: Pubkey,
    pub start_time: i64,
    pub expiry_time: i64,
    pub amount_paid: u64,
    pub inference_count: u64,
    pub is_active: bool,
}
