use anchor_lang::prelude::*;

#[account]
pub struct GlobalState {
    pub bump: u8,
    pub model_counter: u64,
    pub inference_counter: u64,
    pub authority: Pubkey,
}
