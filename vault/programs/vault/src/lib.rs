use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, Mint, MintTo, SetAuthority, TokenAccount, TokenInterface};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

pub mod constants;
pub mod errors;
pub mod state;

use constants::*;
use errors::VaultError;
use state::inference_request::*;
use state::*;

declare_id!("GdsJcVVwzv8sMwyYuKXgKiYouPUEBPHQS54xD4Rd1kDh");

#[ephemeral]
#[program]
pub mod vault {
    use super::*;

    pub fn initialize_global(ctx: Context<InitializeGlobal>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        global_state.bump = ctx.bumps.global_state;
        global_state.model_counter = 0;
        global_state.inference_counter = 0;
        global_state.authority = ctx.accounts.authority.key();

        let escrow = &mut ctx.accounts.revenue_escrow;
        escrow.bump = ctx.bumps.revenue_escrow;
        escrow.total_deposited = 0;
        escrow.total_distributed = 0;
        escrow.protocol_treasury = ctx.accounts.authority.key();
        escrow.protocol_accumulated = 0;

        emit!(GlobalInitialized {
            authority: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    pub fn register_model(ctx: Context<RegisterModel>, args: RegisterModelArgs) -> Result<()> {
        require!(args.price_per_use > 0, VaultError::InvalidPrice);
        require!(args.subscription_price > 0, VaultError::InvalidPrice);

        let model_id = ctx.accounts.global_state.model_counter;
        let clock = Clock::get()?;
        let model_bump = ctx.bumps.model;
        let model_key = ctx.accounts.model.key();
        let authority_key = ctx.accounts.authority.key();
        let mint_key = ctx.accounts.ownership_token_mint.key();
        let ipfs_cid = args.ipfs_cid.clone();

        let bump_bytes = [model_bump];
        let model_seeds = &[MODEL_SEED, &model_id.to_le_bytes()[..], &bump_bytes[..]];

        token_interface::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.ownership_token_mint.to_account_info(),
                    to: ctx.accounts.authority_token_account.to_account_info(),
                    authority: ctx.accounts.model.to_account_info(),
                },
                &[&model_seeds[..]],
            ),
            1,
        )?;

        token_interface::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.model.to_account_info(),
                    account_or_mint: ctx.accounts.ownership_token_mint.to_account_info(),
                },
                &[&model_seeds[..]],
            ),
            token_interface::spl_token_2022::instruction::AuthorityType::MintTokens,
            None,
        )?;

        let model = &mut ctx.accounts.model;
        model.bump = model_bump;
        model.model_id = model_id;
        model.owner = authority_key;
        model.ownership_token_mint = mint_key;
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
        model.contributors = vec![authority_key];
        model.contribution_shares = vec![10000u16];
        model.contribution_proofs = vec![[0u8; 32]];
        model.accumulated_revenue = vec![0u64];
        model.total_revenue = 0;
        model.inference_count = 0;
        model.reputation_score = 5000;
        model.total_ratings = 0;
        model.sum_ratings = 0;
        model.is_active = true;
        model.created_at = clock.unix_timestamp;
        model.updated_at = clock.unix_timestamp;
        model.delegate_validator = Pubkey::default();

        let reputation = &mut ctx.accounts.reputation;
        reputation.bump = ctx.bumps.reputation;
        reputation.model = model_key;
        reputation.score = 5000;
        reputation.total_inferences = 0;
        reputation.successful_inferences = 0;
        reputation.failed_inferences = 0;
        reputation.avg_inference_time_ms = 0;
        reputation.last_updated = clock.unix_timestamp;

        ctx.accounts.global_state.model_counter = model_id.checked_add(1).unwrap();

        emit!(ModelRegistered {
            model_id,
            owner: authority_key,
            ipfs_cid,
        });
        Ok(())
    }

    pub fn register_node(ctx: Context<RegisterNode>, args: RegisterNodeArgs) -> Result<()> {
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

    pub fn update_model(ctx: Context<UpdateModel>, args: UpdateModelArgs) -> Result<()> {
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

    pub fn request_inference(
        ctx: Context<RequestInference>,
        args: RequestInferenceArgs,
    ) -> Result<()> {
        require!(ctx.accounts.model.is_active, VaultError::ModelNotActive);

        let clock = Clock::get()?;
        let nonce = ctx.accounts.global_state.inference_counter;
        let price_per_use = ctx.accounts.model.price_per_use;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.requester.to_account_info(),
                to: ctx.accounts.revenue_escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, price_per_use)?;

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

        ctx.accounts.global_state.inference_counter = nonce.checked_add(1).unwrap();

        emit!(InferenceRequested {
            requester: ctx.accounts.requester.key(),
            model_id: ctx.accounts.model.model_id,
            nonce,
            payment_amount: price_per_use,
        });
        Ok(())
    }

    pub fn request_inference_subscribed(
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

        ctx.accounts.subscription.inference_count = ctx
            .accounts
            .subscription
            .inference_count
            .checked_add(1)
            .unwrap();

        ctx.accounts.global_state.inference_counter = nonce.checked_add(1).unwrap();

        emit!(InferenceRequestedSubscribed {
            requester: ctx.accounts.requester.key(),
            model_id: ctx.accounts.model.model_id,
            nonce,
        });
        Ok(())
    }

    pub fn complete_inference(
        ctx: Context<CompleteInference>,
        args: CompleteInferenceArgs,
    ) -> Result<()> {
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

        ctx.accounts.model.inference_count =
            ctx.accounts.model.inference_count.checked_add(1).unwrap();
        ctx.accounts.model.updated_at = clock.unix_timestamp;

        ctx.accounts.compute_node.inference_count = ctx
            .accounts
            .compute_node
            .inference_count
            .checked_add(1)
            .unwrap();
        ctx.accounts.compute_node.total_inference_time_ms = ctx
            .accounts
            .compute_node
            .total_inference_time_ms
            .checked_add(args.inference_time_ms as u64)
            .unwrap();
        ctx.accounts.compute_node.last_heartbeat = clock.unix_timestamp;

        let rep = &mut ctx.accounts.reputation;
        rep.total_inferences = rep.total_inferences.checked_add(1).unwrap();
        rep.successful_inferences = rep.successful_inferences.checked_add(1).unwrap();
        rep.last_updated = clock.unix_timestamp;
        if rep.total_inferences > 0 {
            rep.avg_inference_time_ms = ((rep.avg_inference_time_ms as u64
                * (rep.total_inferences - 1)
                + args.inference_time_ms as u64)
                / rep.total_inferences) as u32;
        }

        emit!(InferenceCompleted {
            requester: inference.requester,
            model_id: ctx.accounts.model.model_id,
            node: ctx.accounts.node_address.key(),
        });
        Ok(())
    }

    pub fn add_contributor(ctx: Context<AddContributor>, args: AddContributorArgs) -> Result<()> {
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

    pub fn distribute_revenue(ctx: Context<DistributeRevenue>) -> Result<()> {
        require!(
            ctx.accounts.inference_request.status == STATUS_COMPLETED,
            VaultError::InvalidStatus
        );

        let total = ctx.accounts.inference_request.payment_amount;
        if total == 0 {
            return Ok(());
        }

        let contributor_portion = total * CONTRIBUTOR_BPS / TOTAL_BPS;
        let node_portion = total * NODE_BPS / TOTAL_BPS;
        let protocol_portion = total * PROTOCOL_BPS / TOTAL_BPS;

        let model = &mut ctx.accounts.model;
        let total_shares: u16 = model.contribution_shares.iter().sum();

        if total_shares > 0 {
            for i in 0..model.contributors.len() {
                let share =
                    contributor_portion * model.contribution_shares[i] as u64 / total_shares as u64;
                model.accumulated_revenue[i] += share;
            }
        }

        model.total_revenue += total;

        if let Some(node) = &mut ctx.accounts.compute_node {
            node.accumulated_revenue += node_portion;
        }

        ctx.accounts.revenue_escrow.protocol_accumulated += protocol_portion;

        emit!(RevenueDistributed {
            model_id: model.model_id,
            total,
            contributor_portion,
            node_portion,
            protocol_portion,
        });
        Ok(())
    }

    pub fn claim_revenue(ctx: Context<ClaimRevenue>, args: ClaimRevenueArgs) -> Result<()> {
        let idx = args.contributor_index as usize;
        require!(
            idx < ctx.accounts.model.contributors.len(),
            VaultError::Unauthorized
        );
        require!(
            ctx.accounts.contributor.key() == ctx.accounts.model.contributors[idx],
            VaultError::Unauthorized
        );

        let amount = ctx.accounts.model.accumulated_revenue[idx];
        require!(amount > 0, VaultError::NoRevenueToClaim);

        **ctx
            .accounts
            .revenue_escrow
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .contributor
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        ctx.accounts.model.accumulated_revenue[idx] = 0;
        ctx.accounts.revenue_escrow.total_distributed += amount;

        emit!(RevenueClaimed {
            contributor: ctx.accounts.contributor.key(),
            model_id: ctx.accounts.model.model_id,
            amount,
        });
        Ok(())
    }

    pub fn claim_node_revenue(ctx: Context<ClaimNodeRevenue>) -> Result<()> {
        let amount = ctx.accounts.compute_node.accumulated_revenue;
        require!(amount > 0, VaultError::NoRevenueToClaim);

        **ctx
            .accounts
            .revenue_escrow
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .node_address
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        ctx.accounts.compute_node.accumulated_revenue = 0;
        ctx.accounts.revenue_escrow.total_distributed += amount;

        emit!(NodeRevenueClaimed {
            node_address: ctx.accounts.node_address.key(),
            amount,
        });
        Ok(())
    }

    pub fn create_subscription(ctx: Context<CreateSubscription>) -> Result<()> {
        require!(ctx.accounts.model.is_active, VaultError::ModelNotActive);

        let price = ctx.accounts.model.subscription_price;
        let clock = Clock::get()?;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.subscriber.to_account_info(),
                to: ctx.accounts.revenue_escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, price)?;

        ctx.accounts.revenue_escrow.total_deposited += price;

        let sub = &mut ctx.accounts.subscription;
        sub.bump = ctx.bumps.subscription;
        sub.subscriber = ctx.accounts.subscriber.key();
        sub.model = ctx.accounts.model.key();
        sub.start_time = clock.unix_timestamp;
        sub.expiry_time = clock.unix_timestamp + SUBSCRIPTION_DURATION_SECS;
        sub.amount_paid = price;
        sub.inference_count = 0;
        sub.is_active = true;

        emit!(SubscriptionCreated {
            subscriber: ctx.accounts.subscriber.key(),
            model_id: ctx.accounts.model.model_id,
            expiry_time: sub.expiry_time,
        });
        Ok(())
    }

    pub fn list_for_sale(ctx: Context<ListForSale>, args: ListForSaleArgs) -> Result<()> {
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

    pub fn transfer_ownership(ctx: Context<TransferOwnership>) -> Result<()> {
        let model = &mut ctx.accounts.model;

        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: ctx.accounts.owner_token_account.to_account_info(),
                    mint: ctx.accounts.ownership_token_mint.to_account_info(),
                    to: ctx.accounts.new_owner_token_account.to_account_info(),
                    authority: ctx.accounts.current_owner.to_account_info(),
                },
            ),
            1,
            0,
        )?;

        model.owner = ctx.accounts.new_owner.key();
        model.updated_at = Clock::get()?.unix_timestamp;

        emit!(OwnershipTransferred {
            model_id: model.model_id,
            new_owner: ctx.accounts.new_owner.key(),
        });
        Ok(())
    }

    pub fn buy_model(ctx: Context<BuyModel>) -> Result<()> {
        let model = &mut ctx.accounts.model;
        require!(model.is_listed_for_sale, VaultError::NotListedForSale);
        let sale_price = model.sale_price;

        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: ctx.accounts.owner_token_account.to_account_info(),
                    mint: ctx.accounts.ownership_token_mint.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.current_owner.to_account_info(),
                },
            ),
            1,
            0,
        )?;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.current_owner.to_account_info(),
                },
            ),
            sale_price,
        )?;

        model.owner = ctx.accounts.buyer.key();
        model.is_listed_for_sale = false;
        model.sale_price = 0;
        model.updated_at = Clock::get()?.unix_timestamp;

        emit!(ModelSold {
            model_id: model.model_id,
            buyer: ctx.accounts.buyer.key(),
            price: sale_price,
        });
        Ok(())
    }

    // ─── MagicBlock ER Instructions ─────────────────────────────────

    pub fn delegate_pda(ctx: Context<DelegatePda>, seeds: Vec<Vec<u8>>) -> Result<()> {
        let seeds_refs: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();
        let validator = ctx.accounts.validator.as_ref().map(|v| v.key());
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &seeds_refs,
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn delegate_model_to_tee(ctx: Context<DelegateModelToTee>, model_id: u64) -> Result<()> {
        let model_bump = ctx.accounts.model.bump;
        let model_seeds: Vec<&[u8]> = vec![
            MODEL_SEED,
            &model_id.to_le_bytes()[..],
            &[model_bump],
        ];
        let tee_validator = Pubkey::try_from(TEE_VALIDATOR).unwrap();

        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &model_seeds,
            DelegateConfig {
                validator: Some(tee_validator),
                ..Default::default()
            },
        )?;

        let perm_seeds: Vec<&[u8]> = vec![
            PERMISSION_SEED,
            &model_id.to_le_bytes()[..],
        ];

        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &perm_seeds,
            DelegateConfig {
                validator: Some(tee_validator),
                ..Default::default()
            },
        )?;

        let model = &mut ctx.accounts.model;
        model.delegate_validator = tee_validator;

        emit!(ModelDelegatedToTee {
            model_id,
            validator: TEE_VALIDATOR.to_string(),
        });
        Ok(())
    }

    pub fn update_reputation_er(ctx: Context<UpdateReputationEr>, delta: i32) -> Result<()> {
        let rep = &mut ctx.accounts.reputation;
        if delta > 0 {
            rep.score = rep.score.saturating_add(delta as u32);
        } else {
            rep.score = rep.score.saturating_sub((-delta) as u32);
        }
        rep.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn update_node_heartbeat_er(ctx: Context<UpdateNodeHeartbeatEr>) -> Result<()> {
        let node = &mut ctx.accounts.compute_node;
        node.last_heartbeat = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn update_inference_count_er(ctx: Context<UpdateInferenceCountEr>) -> Result<()> {
        let model = &mut ctx.accounts.model;
        model.inference_count = model.inference_count.saturating_add(1);
        let rep = &mut ctx.accounts.reputation;
        rep.total_inferences = rep.total_inferences.saturating_add(1);
        Ok(())
    }

    pub fn commit_state(ctx: Context<CommitState>) -> Result<()> {
        commit_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.pda.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    pub fn commit_and_undelegate(ctx: Context<CommitState>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.pda.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    // ─── MagicBlock Permission Program Instructions ─────────────────

    pub fn create_model_permission(
        ctx: Context<CreateModelPermission>,
        model_id: u64,
        members: Vec<MemberArgs>,
    ) -> Result<()> {
        let model_bump = ctx.accounts.model.bump;
        let seeds = &[MODEL_SEED, &model_id.to_le_bytes()[..], &[model_bump]];

        let mb_members: Vec<ephemeral_rollups_sdk::cpi::Member> = members
            .iter()
            .map(|m| ephemeral_rollups_sdk::cpi::Member {
                flags: m.flags,
                pubkey: m.pubkey,
            })
            .collect();

        ephemeral_rollups_sdk::cpi::CreatePermissionCpiBuilder::new(
            &ctx.accounts.permission_program,
        )
        .permissioned_account(&ctx.accounts.model.to_account_info())
        .permission(&ctx.accounts.permission.to_account_info())
        .payer(&ctx.accounts.payer)
        .system_program(&ctx.accounts.system_program)
        .args(ephemeral_rollups_sdk::cpi::MembersArgs {
            members: Some(mb_members),
        })
        .invoke_signed(&[seeds])?;

        Ok(())
    }

    pub fn update_model_permission(
        ctx: Context<UpdateModelPermission>,
        model_id: u64,
        members: Vec<MemberArgs>,
    ) -> Result<()> {
        let model_bump = ctx.accounts.model.bump;
        let seeds = &[MODEL_SEED, &model_id.to_le_bytes()[..], &[model_bump]];

        let mb_members: Vec<ephemeral_rollups_sdk::cpi::Member> = members
            .iter()
            .map(|m| ephemeral_rollups_sdk::cpi::Member {
                flags: m.flags,
                pubkey: m.pubkey,
            })
            .collect();

        ephemeral_rollups_sdk::cpi::UpdatePermissionCpiBuilder::new(
            &ctx.accounts.permission_program,
        )
        .permissioned_account(&ctx.accounts.model.to_account_info(), true)
        .authority(&ctx.accounts.model.to_account_info(), false)
        .permission(&ctx.accounts.permission.to_account_info())
        .args(ephemeral_rollups_sdk::cpi::MembersArgs {
            members: Some(mb_members),
        })
        .invoke_signed(&[seeds])?;

        Ok(())
    }

    // ─── MagicBlock VRF Instructions ─────────────────────────────────

    pub fn assign_node_vrf(ctx: Context<AssignNodeVrf>, client_seed: u8) -> Result<()> {
        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: ID,
            callback_discriminator: instruction::CallbackAssignNode::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![
                SerializableAccountMeta {
                    pubkey: ctx.accounts.inference_request.key(),
                    is_signer: false,
                    is_writable: true,
                },
                SerializableAccountMeta {
                    pubkey: ctx.accounts.model.key(),
                    is_signer: false,
                    is_writable: true,
                },
            ]),
            ..Default::default()
        });
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    pub fn callback_assign_node(
        ctx: Context<CallbackAssignNode>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let inference = &mut ctx.accounts.inference_request;
        inference.assigned_node = Pubkey::new_from_array(randomness);
        inference.status = STATUS_NODE_ASSIGNED;

        emit!(NodeAssignedVrf {
            inference: inference.key(),
            randomness: randomness,
        });
        Ok(())
    }
}
}

// ─── Accounts Structs ────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeGlobal<'info> {
    #[account(
        init,
        payer = authority,
        space = GLOBAL_STATE_SIZE,
        seeds = [GLOBAL_SEED],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,
    #[account(
        init,
        payer = authority,
        space = ESCROW_SIZE,
        seeds = [ESCROW_SEED],
        bump,
    )]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

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
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = model,
        mint::token_program = token_program,
        seeds = [OWNERSHIP_MINT_SEED, global_state.model_counter.to_le_bytes().as_ref()],
        bump,
    )]
    pub ownership_token_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = ownership_token_mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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

#[derive(Accounts)]
pub struct CompleteInference<'info> {
    #[account(mut)]
    pub node_address: Signer<'info>,
    #[account(mut)]
    pub inference_request: Account<'info, InferenceRequest>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    #[account(
        mut,
        seeds = [NODE_SEED, node_address.key().as_ref()],
        bump = compute_node.bump,
    )]
    pub compute_node: Account<'info, ComputeNode>,
    #[account(
        mut,
        seeds = [REPUTATION_SEED, model.key().as_ref()],
        bump = reputation.bump,
    )]
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

#[derive(Accounts)]
pub struct ClaimRevenue<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    #[account(
        mut,
        seeds = [ESCROW_SEED],
        bump = revenue_escrow.bump,
    )]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ClaimRevenueArgs {
    pub contributor_index: u8,
}

#[derive(Accounts)]
pub struct ClaimNodeRevenue<'info> {
    #[account(mut)]
    pub node_address: Signer<'info>,
    #[account(
        mut,
        seeds = [NODE_SEED, node_address.key().as_ref()],
        bump = compute_node.bump,
    )]
    pub compute_node: Account<'info, ComputeNode>,
    #[account(
        mut,
        seeds = [ESCROW_SEED],
        bump = revenue_escrow.bump,
    )]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    pub system_program: Program<'info, System>,
}

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
    #[account(
        mut,
        seeds = [ESCROW_SEED],
        bump = revenue_escrow.bump,
    )]
    pub revenue_escrow: Account<'info, RevenueEscrow>,
    pub system_program: Program<'info, System>,
}

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

// ─── Events ──────────────────────────────────────────────────────────

#[event]
pub struct GlobalInitialized {
    pub authority: Pubkey,
}

#[event]
pub struct ModelRegistered {
    pub model_id: u64,
    pub owner: Pubkey,
    pub ipfs_cid: String,
}

#[event]
pub struct NodeRegistered {
    pub node_address: Pubkey,
}

#[event]
pub struct ModelUpdated {
    pub model_id: u64,
}

#[event]
pub struct InferenceRequested {
    pub requester: Pubkey,
    pub model_id: u64,
    pub nonce: u64,
    pub payment_amount: u64,
}

#[event]
pub struct InferenceRequestedSubscribed {
    pub requester: Pubkey,
    pub model_id: u64,
    pub nonce: u64,
}

#[event]
pub struct InferenceCompleted {
    pub requester: Pubkey,
    pub model_id: u64,
    pub node: Pubkey,
}

#[event]
pub struct ContributorAdded {
    pub model_id: u64,
    pub contributor: Pubkey,
    pub share: u16,
}

#[event]
pub struct RevenueDistributed {
    pub model_id: u64,
    pub total: u64,
    pub contributor_portion: u64,
    pub node_portion: u64,
    pub protocol_portion: u64,
}

#[event]
pub struct RevenueClaimed {
    pub contributor: Pubkey,
    pub model_id: u64,
    pub amount: u64,
}

#[event]
pub struct NodeRevenueClaimed {
    pub node_address: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SubscriptionCreated {
    pub subscriber: Pubkey,
    pub model_id: u64,
    pub expiry_time: i64,
}

#[event]
pub struct ModelListedForSale {
    pub model_id: u64,
    pub sale_price: u64,
}

#[event]
pub struct OwnershipTransferred {
    pub model_id: u64,
    pub new_owner: Pubkey,
}

#[event]
pub struct ModelSold {
    pub model_id: u64,
    pub buyer: Pubkey,
    pub price: u64,
}

// ─── Token-2022 Accounts Structs ─────────────────────────────────────

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(mut)]
    pub current_owner: Signer<'info>,
    pub new_owner: SystemAccount<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    pub ownership_token_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = ownership_token_mint,
        associated_token::authority = current_owner,
        associated_token::token_program = token_program,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = current_owner,
        associated_token::mint = ownership_token_mint,
        associated_token::authority = new_owner,
        associated_token::token_program = token_program,
    )]
    pub new_owner_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyModel<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub current_owner: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    pub ownership_token_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = ownership_token_mint,
        associated_token::authority = current_owner,
        associated_token::token_program = token_program,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = ownership_token_mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program,
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ─── MagicBlock ER Account Structs ──────────────────────────────────

#[delegate]
#[derive(Accounts)]
pub struct DelegatePda<'info> {
    pub payer: Signer<'info>,
    /// CHECK: Checked by the delegate program
    pub validator: Option<AccountInfo<'info>>,
    /// CHECK: The pda to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateModelToTee<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    /// CHECK: Permission PDA derived from model seeds
    #[account(mut, del)]
    pub permission: AccountInfo<'info>,
    /// CHECK: Checked by delegate program
    pub validator: Option<AccountInfo<'info>>,
}

#[derive(Accounts)]
pub struct UpdateReputationEr<'info> {
    #[account(
        mut,
        seeds = [REPUTATION_SEED, model.key().as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, Reputation>,
    /// CHECK: Model PDA - needed for seed derivation
    pub model: Account<'info, ModelRegistry>,
}

#[derive(Accounts)]
pub struct UpdateNodeHeartbeatEr<'info> {
    #[account(
        mut,
        seeds = [NODE_SEED, compute_node.node_address.as_ref()],
        bump = compute_node.bump,
    )]
    pub compute_node: Account<'info, ComputeNode>,
}

#[derive(Accounts)]
pub struct UpdateInferenceCountEr<'info> {
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    #[account(
        mut,
        seeds = [REPUTATION_SEED, model.key().as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, Reputation>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitState<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PDA to commit
    #[account(mut)]
    pub pda: AccountInfo<'info>,
}

// ─── MagicBlock Permission Account Structs ─────────────────────────

#[derive(Accounts)]
pub struct CreateModelPermission<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    /// CHECK: Permission PDA - checked by permission program
    #[account(mut)]
    pub permission: AccountInfo<'info>,
    /// CHECK: Permission program
    #[account(address = Pubkey::try_from(PERMISSION_PROGRAM_ID).unwrap())]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateModelPermission<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    /// CHECK: Permission PDA - checked by permission program
    #[account(mut)]
    pub permission: AccountInfo<'info>,
    /// CHECK: Permission program
    #[account(address = Pubkey::try_from(PERMISSION_PROGRAM_ID).unwrap())]
    pub permission_program: UncheckedAccount<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MemberArgs {
    pub flags: u64,
    pub pubkey: Pubkey,
}

// ─── MagicBlock VRF Account Structs ─────────────────────────────────

#[vrf]
#[derive(Accounts)]
pub struct AssignNodeVrf<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub inference_request: Account<'info, InferenceRequest>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
    /// CHECK: The oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CallbackAssignNode<'info> {
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub inference_request: Account<'info, InferenceRequest>,
    #[account(mut)]
    pub model: Account<'info, ModelRegistry>,
}

// ─── New Events ─────────────────────────────────────────────────────

#[event]
pub struct ModelDelegatedToTee {
    pub model_id: u64,
    pub validator: String,
}

#[event]
pub struct NodeAssignedVrf {
    pub inference: Pubkey,
    pub randomness: [u8; 32],
}
