use crate::errors::VaultError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ListForSale<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ListForSaleArgs {
    pub sale_price: u64,
}

pub fn handler(ctx: Context<ListForSale>, args: ListForSaleArgs) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.model.owner,
        VaultError::Unauthorized
    );
    require!(args.sale_price > 0, VaultError::InvalidPrice);
    require!(
        !ctx.accounts.model.is_listed_for_sale,
        VaultError::AlreadyListedForSale
    );

    let model = &mut ctx.accounts.model;
    model.is_listed_for_sale = true;
    model.sale_price = args.sale_price;
    model.updated_at = Clock::get()?.unix_timestamp;

    emit!(ModelListedForSale {
        model_id: model.model_id,
        sale_price: args.sale_price,
    });

    Ok(())
}

#[event]
pub struct ModelListedForSale {
    pub model_id: u64,
    pub sale_price: u64,
}
