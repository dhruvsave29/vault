use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RegisterNode<'info> {
    #[account(mut)]
    pub node_address: Signer<'info>,
    #[account(
        init,
        payer = node_address,
        space = NODE_SIZE,
        seeds = [NODE_SEED, node_address.key().as_ref()],
        bump,
    )]
    pub compute_node: Account<'info, ComputeNode>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RegisterNodeArgs {
    pub endpoint_url: String,
    pub supported_task_types: u16,
    pub max_model_size_kb: u32,
}

pub fn handler(ctx: Context<RegisterNode>, args: RegisterNodeArgs) -> Result<()> {
    let node = &mut ctx.accounts.compute_node;
    let clock = Clock::get()?;

    node.bump = ctx.bumps.compute_node;
    node.node_address = ctx.accounts.node_address.key();
    node.endpoint_url = args.endpoint_url;
    node.stake = 0;
    node.inference_count = 0;
    node.total_inference_time_ms = 0;
    node.uptime_score = 5000;
    node.reputation = 5000;
    node.tee_attestation_hash = [0u8; 32];
    node.supported_task_types = args.supported_task_types;
    node.max_model_size_kb = args.max_model_size_kb;
    node.is_active = true;
    node.registered_at = clock.unix_timestamp;
    node.last_heartbeat = clock.unix_timestamp;
    node.accumulated_revenue = 0;

    emit!(NodeRegistered {
        node_address: ctx.accounts.node_address.key(),
    });

    Ok(())
}

#[event]
pub struct NodeRegistered {
    pub node_address: Pubkey,
}
