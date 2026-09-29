use anchor_lang::prelude::*;

#[account]
pub struct RevenueEscrow {
    pub bump: u8,
    pub total_deposited: u64,
    pub total_distributed: u64,
    pub protocol_treasury: Pubkey,
    pub protocol_accumulated: u64,
}
