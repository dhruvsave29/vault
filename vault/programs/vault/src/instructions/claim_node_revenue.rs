use crate::constants::*;
use crate::errors::VaultError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ClaimNodeRevenue<'info> {
    pub node_address: Signer<'info>,
    #[account(
        mut,
        seeds = [NODE_SEED, node_address.key().as_ref()],
        bump = compute_node.bump,
    )]
    pub compute_node: Account<'info, ComputeNode>,
    #[account(
        mut,
        seeds = [ESCROW_SEED],
        bump = revenue_escrow.bump,
    )]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimNodeRevenue>) -> Result<()> {
    let amount = ctx.accounts.compute_node.accumulated_revenue;
    require!(amount > 0, VaultError::NoRevenueToClaim);

    let escrow_bump = ctx.accounts.revenue_escrow.bump;
    let escrow_seeds = &[ESCROW_SEED, &[escrow_bump]];
    let signer_seeds = &[&escrow_seeds[..]];

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.revenue_escrow.to_account_info(),
            to: ctx.accounts.node_address.to_account_info(),
        },
        signer_seeds,
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    let node = &mut ctx.accounts.compute_node;
    node.accumulated_revenue = 0;

    let escrow = &mut ctx.accounts.revenue_escrow;
    escrow.total_distributed = escrow
        .total_distributed
        .checked_add(amount)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    emit!(NodeRevenueClaimed {
        node_address: ctx.accounts.node_address.key(),
        amount,
    });

    Ok(())
}

#[event]
pub struct NodeRevenueClaimed {
    pub node_address: Pubkey,
    pub amount: u64,
}
