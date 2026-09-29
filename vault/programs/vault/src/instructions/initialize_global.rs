use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeGlobal<'info> {
    #[account(
        init,
        payer = authority,
        space = GLOBAL_STATE_SIZE,
        seeds = [GLOBAL_SEED],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,
    #[account(
        init,
        payer = authority,
        space = ESCROW_SIZE,
        seeds = [ESCROW_SEED],
        bump,
    )]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeGlobal>) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    global_state.bump = ctx.bumps.global_state;
    global_state.model_counter = 0;
    global_state.inference_counter = 0;
    global_state.authority = ctx.accounts.authority.key();

    let escrow = &mut ctx.accounts.revenue_escrow;
    escrow.bump = ctx.bumps.revenue_escrow;
    escrow.total_deposited = 0;
    escrow.total_distributed = 0;
    escrow.protocol_treasury = ctx.accounts.authority.key();
    escrow.protocol_accumulated = 0;

    emit!(GlobalInitialized {
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}

#[event]
pub struct GlobalInitialized {
    pub authority: Pubkey,
}
