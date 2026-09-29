use crate::constants::*;
use crate::errors::VaultError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ClaimRevenue<'info> {
    pub contributor: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    #[account(
        mut,
        seeds = [ESCROW_SEED],
        bump = revenue_escrow.bump,
    )]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ClaimRevenueArgs {
    pub contributor_index: u8,
}

pub fn handler(ctx: Context<ClaimRevenue>, args: ClaimRevenueArgs) -> Result<()> {
    let idx = args.contributor_index as usize;
    let model = &ctx.accounts.model;

    require!(idx < model.contributors.len(), VaultError::Unauthorized);
    require!(
        ctx.accounts.contributor.key() == model.contributors[idx],
        VaultError::Unauthorized
    );

    let amount = model.accumulated_revenue[idx];
    require!(amount > 0, VaultError::NoRevenueToClaim);

    let escrow_bump = ctx.accounts.revenue_escrow.bump;
    let escrow_seeds = &[ESCROW_SEED, &[escrow_bump]];
    let signer_seeds = &[&escrow_seeds[..]];

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.revenue_escrow.to_account_info(),
            to: ctx.accounts.contributor.to_account_info(),
        },
        signer_seeds,
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    let model = &mut ctx.accounts.model;
    model.accumulated_revenue[idx] = 0;

    let escrow = &mut ctx.accounts.revenue_escrow;
    escrow.total_distributed = escrow
        .total_distributed
        .checked_add(amount)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    emit!(RevenueClaimed {
        contributor: ctx.accounts.contributor.key(),
        model_id: model.model_id,
        amount,
    });

    Ok(())
}

#[event]
pub struct RevenueClaimed {
    pub contributor: Pubkey,
    pub model_id: u64,
    pub amount: u64,
}
