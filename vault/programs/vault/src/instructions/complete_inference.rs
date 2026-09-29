use crate::errors::VaultError;
use crate::state::inference_request::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CompleteInference<'info> {
    #[account(mut)]
    pub node_address: Signer<'info>,
    #[account(mut)]
    pub inference_request: Account<'info, InferenceRequest>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    #[account(mut)]
    pub compute_node: Account<'info, ComputeNode>,
    #[account(mut)]
    pub reputation: Account<'info, Reputation>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CompleteInferenceArgs {
    pub output_hash: [u8; 32],
    pub inference_time_ms: u32,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub compute_flops: u64,
    pub memory_peak_kb: u32,
    pub tee_attestation_hash: [u8; 32],
}

pub fn handler(ctx: Context<CompleteInference>, args: CompleteInferenceArgs) -> Result<()> {
    require!(
        ctx.accounts.compute_node.node_address == ctx.accounts.node_address.key(),
        VaultError::NotAssignedNode
    );
    require!(
        ctx.accounts.compute_node.is_active,
        VaultError::NodeNotActive
    );
    require!(
        ctx.accounts.inference_request.status == STATUS_PAID
            || ctx.accounts.inference_request.status == STATUS_NODE_ASSIGNED,
        VaultError::InvalidStatus
    );

    let clock = Clock::get()?;

    let inference = &mut ctx.accounts.inference_request;
    inference.assigned_node = ctx.accounts.node_address.key();
    inference.output_hash = args.output_hash;
    inference.inference_time_ms = args.inference_time_ms;
    inference.input_tokens = args.input_tokens;
    inference.output_tokens = args.output_tokens;
    inference.compute_flops = args.compute_flops;
    inference.memory_peak_kb = args.memory_peak_kb;
    inference.tee_attestation_hash = args.tee_attestation_hash;
    inference.status = STATUS_COMPLETED;
    inference.completed_at = clock.unix_timestamp;

    ctx.accounts.model.inference_count = ctx
        .accounts
        .model
        .inference_count
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;
    ctx.accounts.model.updated_at = clock.unix_timestamp;

    ctx.accounts.compute_node.inference_count = ctx
        .accounts
        .compute_node
        .inference_count
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;
    ctx.accounts.compute_node.total_inference_time_ms = ctx
        .accounts
        .compute_node
        .total_inference_time_ms
        .checked_add(args.inference_time_ms as u64)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;
    ctx.accounts.compute_node.last_heartbeat = clock.unix_timestamp;

    let reputation = &mut ctx.accounts.reputation;
    reputation.total_inferences = reputation
        .total_inferences
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;
    reputation.successful_inferences = reputation
        .successful_inferences
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;
    reputation.last_updated = clock.unix_timestamp;

    if reputation.total_inferences > 0 {
        reputation.avg_inference_time_ms = ((reputation.avg_inference_time_ms as u64
            * (reputation.total_inferences - 1)
            + args.inference_time_ms as u64)
            / reputation.total_inferences) as u32;
    }

    emit!(InferenceCompleted {
        requester: inference.requester,
        model_id: ctx.accounts.model.model_id,
        node: ctx.accounts.node_address.key(),
    });

    Ok(())
}

#[event]
pub struct InferenceCompleted {
    pub requester: Pubkey,
    pub model_id: u64,
    pub node: Pubkey,
}
