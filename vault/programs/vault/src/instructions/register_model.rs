use crate::constants::*;
use crate::errors::VaultError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RegisterModel<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    #[account(
        init,
        payer = authority,
        space = MODEL_SIZE,
        seeds = [MODEL_SEED, global_state.model_counter.to_le_bytes().as_ref()],
        bump,
    )]
    pub model: Account<'info, ModelRegistry>,
    #[account(
        init,
        payer = authority,
        space = REPUTATION_SIZE,
        seeds = [REPUTATION_SEED, model.key().as_ref()],
        bump,
    )]
    pub reputation: Account<'info, Reputation>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterModelArgs {
    pub ipfs_cid: String,
    pub encryption_key_hash: [u8; 32],
    pub model_format: u8,
    pub task_type: u8,
    pub framework_version: String,
    pub accuracy_claim: u16,
    pub price_per_use: u64,
    pub subscription_price: u64,
}

pub fn handler(ctx: Context<RegisterModel>, args: RegisterModelArgs) -> Result<()> {
    require!(args.price_per_use > 0, VaultError::InvalidPrice);
    require!(args.subscription_price > 0, VaultError::InvalidPrice);

    let model = &mut ctx.accounts.model;
    let model_id = ctx.accounts.global_state.model_counter;

    model.bump = ctx.bumps.model;
    model.model_id = model_id;
    model.owner = ctx.accounts.authority.key();
    model.ownership_token_mint = Pubkey::default();
    model.ipfs_cid = args.ipfs_cid;
    model.encryption_key_hash = args.encryption_key_hash;
    model.model_format = args.model_format;
    model.task_type = args.task_type;
    model.framework_version = args.framework_version;
    model.accuracy_claim = args.accuracy_claim;
    model.zk_accuracy_proof_hash = [0u8; 32];
    model.price_per_use = args.price_per_use;
    model.subscription_price = args.subscription_price;
    model.is_listed_for_sale = false;
    model.sale_price = 0;
    model.contributors = vec![ctx.accounts.authority.key()];
    model.contribution_shares = vec![10000u16];
    model.contribution_proofs = vec![[0u8; 32]];
    model.accumulated_revenue = vec![0u64];
    model.total_revenue = 0;
    model.inference_count = 0;
    model.reputation_score = 5000;
    model.total_ratings = 0;
    model.sum_ratings = 0;
    model.is_active = true;
    model.created_at = Clock::get()?.unix_timestamp;
    model.updated_at = Clock::get()?.unix_timestamp;
    model.delegate_validator = Pubkey::default();

    let reputation = &mut ctx.accounts.reputation;
    reputation.bump = ctx.bumps.reputation;
    reputation.model = model.key();
    reputation.score = 5000;
    reputation.total_inferences = 0;
    reputation.successful_inferences = 0;
    reputation.failed_inferences = 0;
    reputation.avg_inference_time_ms = 0;
    reputation.last_updated = Clock::get()?.unix_timestamp;

    ctx.accounts.global_state.model_counter = model_id
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::InvalidPrice))?;

    emit!(ModelRegistered {
        model_id,
        owner: ctx.accounts.authority.key(),
        ipfs_cid: model.ipfs_cid.clone(),
    });

    Ok(())
}

#[event]
pub struct ModelRegistered {
    pub model_id: u64,
    pub owner: Pubkey,
    pub ipfs_cid: String,
}
