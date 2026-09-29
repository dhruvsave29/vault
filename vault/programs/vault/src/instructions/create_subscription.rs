use crate::constants::*;
use crate::errors::VaultError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CreateSubscription<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    #[account(
        init,
        payer = subscriber,
        space = SUBSCRIPTION_SIZE,
        seeds = [SUBSCRIPTION_SEED, subscriber.key().as_ref(), model.key().as_ref()],
        bump,
    )]
    pub subscription: Account<'info, Subscription>,
    #[account(mut)]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateSubscription>) -> Result<()> {
    require!(ctx.accounts.model.is_active, VaultError::ModelNotActive);

    let price = ctx.accounts.model.subscription_price;
    let clock = Clock::get()?;

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.subscriber.to_account_info(),
            to: ctx.accounts.revenue_escrow.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, price)?;

    let escrow = &mut ctx.accounts.revenue_escrow;
    escrow.total_deposited = escrow
        .total_deposited
        .checked_add(price)
        .ok_or_else(|| error!(VaultError::InsufficientPayment))?;

    let subscription = &mut ctx.accounts.subscription;
    subscription.bump = ctx.bumps.subscription;
    subscription.subscriber = ctx.accounts.subscriber.key();
    subscription.model = ctx.accounts.model.key();
    subscription.start_time = clock.unix_timestamp;
    subscription.expiry_time = clock.unix_timestamp + SUBSCRIPTION_DURATION_SECS;
    subscription.amount_paid = price;
    subscription.inference_count = 0;
    subscription.is_active = true;

    emit!(SubscriptionCreated {
        subscriber: ctx.accounts.subscriber.key(),
        model_id: ctx.accounts.model.model_id,
        expiry_time: subscription.expiry_time,
    });

    Ok(())
}

#[event]
pub struct SubscriptionCreated {
    pub subscriber: Pubkey,
    pub model_id: u64,
    pub expiry_time: i64,
}
