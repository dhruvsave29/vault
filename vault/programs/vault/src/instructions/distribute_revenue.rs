use crate::constants::*;
use crate::errors::VaultError;
use crate::state::inference_request::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct DistributeRevenue<'info> {
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    #[account(
        constraint = inference_request.model == model.key() @ VaultError::InferenceNotFound,
    )]
    pub inference_request: Account<'info, InferenceRequest>,
    #[account(mut)]
    pub compute_node: Option<Account<'info, ComputeNode>>,
    #[account(mut)]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
}

pub fn handler(ctx: Context<DistributeRevenue>) -> Result<()> {
    require!(
        ctx.accounts.inference_request.status == STATUS_COMPLETED,
        VaultError::InvalidStatus
    );

    let total = ctx.accounts.inference_request.payment_amount;
    if total == 0 {
        return Ok(());
    }

    let contributor_portion = total
        .checked_mul(CONTRIBUTOR_BPS)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?
        .checked_div(TOTAL_BPS)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    let node_portion = total
        .checked_mul(NODE_BPS)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?
        .checked_div(TOTAL_BPS)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    let protocol_portion = total
        .checked_mul(PROTOCOL_BPS)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?
        .checked_div(TOTAL_BPS)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    let model = &mut ctx.accounts.model;
    let total_shares: u16 = model.contribution_shares.iter().sum();

    if total_shares > 0 {
        for i in 0..model.contributors.len() {
            let contributor_share = contributor_portion
                .checked_mul(model.contribution_shares[i] as u64)
                .ok_or_else(|| error!(VaultError::InvalidPrice))?
                .checked_div(total_shares as u64)
                .ok_or_else(|| error!(VaultError::InvalidPrice))?;
            model.accumulated_revenue[i] = model.accumulated_revenue[i]
                .checked_add(contributor_share)
                .ok_or_else(|| error!(VaultError::InvalidPrice))?;
        }
    }

    model.total_revenue = model
        .total_revenue
        .checked_add(total)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    if let Some(node) = &mut ctx.accounts.compute_node {
        node.accumulated_revenue = node
            .accumulated_revenue
            .checked_add(node_portion)
            .ok_or_else(|| error!(VaultError::InvalidPrice))?;
    }

    let escrow = &mut ctx.accounts.revenue_escrow;
    escrow.protocol_accumulated = escrow
        .protocol_accumulated
        .checked_add(protocol_portion)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    emit!(RevenueDistributed {
        model_id: model.model_id,
        total,
        contributor_portion,
        node_portion,
        protocol_portion,
    });

    Ok(())
}

#[event]
pub struct RevenueDistributed {
    pub model_id: u64,
    pub total: u64,
    pub contributor_portion: u64,
    pub node_portion: u64,
    pub protocol_portion: u64,
}
