use crate::errors::VaultError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateModel<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateModelArgs {
    pub price_per_use: Option<u64>,
    pub subscription_price: Option<u64>,
    pub is_active: Option<bool>,
}

pub fn handler(ctx: Context<UpdateModel>, args: UpdateModelArgs) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.model.owner,
        VaultError::Unauthorized
    );

    let model = &mut ctx.accounts.model;

    if let Some(price) = args.price_per_use {
        require!(price > 0, VaultError::InvalidPrice);
        model.price_per_use = price;
    }

    if let Some(price) = args.subscription_price {
        require!(price > 0, VaultError::InvalidPrice);
        model.subscription_price = price;
    }

    if let Some(active) = args.is_active {
        model.is_active = active;
    }

    model.updated_at = Clock::get()?.unix_timestamp;

    emit!(ModelUpdated {
        model_id: model.model_id,
    });

    Ok(())
}

#[event]
pub struct ModelUpdated {
    pub model_id: u64,
}
