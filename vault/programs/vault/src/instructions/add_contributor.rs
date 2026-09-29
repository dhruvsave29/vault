use crate::constants::MAX_CONTRIBUTORS;
use crate::errors::VaultError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddContributor<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddContributorArgs {
    pub contributor: Pubkey,
    pub share: u16,
    pub proof_hash: [u8; 32],
}

pub fn handler(ctx: Context<AddContributor>, args: AddContributorArgs) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.model.owner,
        VaultError::Unauthorized
    );
    require!(
        ctx.accounts.model.contributors.len() < MAX_CONTRIBUTORS,
        VaultError::MaxContributorsReached
    );

    let model = &mut ctx.accounts.model;

    let mut new_shares = model.contribution_shares.clone();
    new_shares.push(args.share);

    require!(
        ModelRegistry::validate_shares(&new_shares),
        VaultError::InvalidContributionShares
    );

    model.contributors.push(args.contributor);
    model.contribution_shares.push(args.share);
    model.contribution_proofs.push(args.proof_hash);
    model.accumulated_revenue.push(0);

    model.updated_at = Clock::get()?.unix_timestamp;

    emit!(ContributorAdded {
        model_id: model.model_id,
        contributor: args.contributor,
        share: args.share,
    });

    Ok(())
}

#[event]
pub struct ContributorAdded {
    pub model_id: u64,
    pub contributor: Pubkey,
    pub share: u16,
}
