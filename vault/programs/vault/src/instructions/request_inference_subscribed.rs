use crate::constants::*;
use crate::errors::VaultError;
use crate::state::global_state::GlobalState;
use crate::state::inference_request::{InferenceRequest, STATUS_PAID};
use crate::state::model_registry::ModelRegistry;
use crate::state::subscription::Subscription;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RequestInferenceSubscribed<'info> {
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
    #[account(
        mut,
        seeds = [SUBSCRIPTION_SEED, requester.key().as_ref(), model.key().as_ref()],
        bump = subscription.bump,
        constraint = subscription.subscriber == requester.key() @ VaultError::Unauthorized,
        constraint = subscription.model == model.key() @ VaultError::ModelNotFound,
    )]
    pub subscription: Account<'info, Subscription>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RequestInferenceSubscribedArgs {
    pub input_hash: [u8; 32],
}

pub fn handler(
    ctx: Context<RequestInferenceSubscribed>,
    args: RequestInferenceSubscribedArgs,
) -> Result<()> {
    require!(ctx.accounts.model.is_active, VaultError::ModelNotActive);

    let clock = Clock::get()?;
    require!(
        ctx.accounts.subscription.is_active,
        VaultError::SubscriptionExpired
    );
    require!(
        clock.unix_timestamp < ctx.accounts.subscription.expiry_time,
        VaultError::SubscriptionExpired
    );

    let nonce = ctx.accounts.global_state.inference_counter;

    let inference = &mut ctx.accounts.inference_request;
    inference.bump = ctx.bumps.inference_request;
    inference.requester = ctx.accounts.requester.key();
    inference.model = ctx.accounts.model.key();
    inference.assigned_node = Pubkey::default();
    inference.input_hash = args.input_hash;
    inference.output_hash = [0u8; 32];
    inference.zk_inference_proof = [0u8; 32];
    inference.payment_amount = 0;
    inference.payment_signature = String::from("");
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

    let subscription = &mut ctx.accounts.subscription;
    subscription.inference_count = subscription
        .inference_count
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    ctx.accounts.global_state.inference_counter = nonce
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    emit!(InferenceRequestedSubscribed {
        requester: ctx.accounts.requester.key(),
        model_id: ctx.accounts.model.model_id,
        nonce,
    });

    Ok(())
}

#[event]
pub struct InferenceRequestedSubscribed {
    pub requester: Pubkey,
    pub model_id: u64,
    pub nonce: u64,
}
