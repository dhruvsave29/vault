use crate::constants::*;
use crate::errors::VaultError;
use crate::state::global_state::GlobalState;
use crate::state::inference_request::{InferenceRequest, STATUS_PAID};
use crate::state::model_registry::ModelRegistry;
use crate::state::revenue_escrow::RevenueEscrow;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RequestInference<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    #[account(
        init,
        payer = requester,
        space = INFERENCE_SIZE,
        seeds = [
            INFERENCE_SEED,
            requester.key().as_ref(),
            global_state.inference_counter.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub inference_request: Account<'info, InferenceRequest>,
    #[account(mut)]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RequestInferenceArgs {
    pub input_hash: [u8; 32],
    pub payment_signature: String,
}

pub fn handler(ctx: Context<RequestInference>, args: RequestInferenceArgs) -> Result<()> {
    require!(ctx.accounts.model.is_active, VaultError::ModelNotActive);

    let clock = Clock::get()?;
    let nonce = ctx.accounts.global_state.inference_counter;
    let price_per_use = ctx.accounts.model.price_per_use;

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.requester.to_account_info(),
            to: ctx.accounts.revenue_escrow.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, price_per_use)?;

    ctx.accounts.revenue_escrow.total_deposited = ctx
        .accounts
        .revenue_escrow
        .total_deposited
        .checked_add(price_per_use)
        .ok_or_else(|| error!(VaultError::InsufficientPayment))?;

    let inference = &mut ctx.accounts.inference_request;
    inference.bump = ctx.bumps.inference_request;
    inference.requester = ctx.accounts.requester.key();
    inference.model = ctx.accounts.model.key();
    inference.assigned_node = Pubkey::default();
    inference.input_hash = args.input_hash;
    inference.output_hash = [0u8; 32];
    inference.zk_inference_proof = [0u8; 32];
    inference.payment_amount = price_per_use;
    inference.payment_signature = args.payment_signature;
    inference.status = STATUS_PAID;
    inference.inference_time_ms = 0;
    inference.input_tokens = 0;
    inference.output_tokens = 0;
    inference.compute_flops = 0;
    inference.memory_peak_kb = 0;
    inference.tee_attestation_hash = [0u8; 32];
    inference.rating = 0;
    inference.created_at = clock.unix_timestamp;
    inference.completed_at = 0;

    ctx.accounts.global_state.inference_counter = nonce
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    emit!(InferenceRequested {
        requester: ctx.accounts.requester.key(),
        model_id: ctx.accounts.model.model_id,
        nonce,
        payment_amount: price_per_use,
    });

    Ok(())
}

#[event]
pub struct InferenceRequested {
    pub requester: Pubkey,
    pub model_id: u64,
    pub nonce: u64,
    pub payment_amount: u64,
}
