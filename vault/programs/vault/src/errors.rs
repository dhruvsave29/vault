use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Model not found")]
    ModelNotFound,
    #[msg("Unauthorized: only the owner can perform this action")]
    Unauthorized,
    #[msg("Invalid price: must be greater than zero")]
    InvalidPrice,
    #[msg("Insufficient payment amount")]
    InsufficientPayment,
    #[msg("Compute node is not active")]
    NodeNotActive,
    #[msg("Contribution shares must sum to 10000 basis points or less")]
    InvalidContributionShares,
    #[msg("Maximum number of contributors reached")]
    MaxContributorsReached,
    #[msg("Model is already listed for sale")]
    AlreadyListedForSale,
    #[msg("Model is not listed for sale")]
    NotListedForSale,
    #[msg("Subscription has expired")]
    SubscriptionExpired,
    #[msg("Active subscription already exists")]
    SubscriptionAlreadyActive,
    #[msg("Invalid inference request status for this operation")]
    InvalidStatus,
    #[msg("ZK proof verification failed")]
    ProofVerificationFailed,
    #[msg("TEE attestation verification failed")]
    TeeAttestationFailed,
    #[msg("No revenue to claim")]
    NoRevenueToClaim,
    #[msg("Model is not active")]
    ModelNotActive,
    #[msg("Only the assigned compute node can complete this inference")]
    NotAssignedNode,
    #[msg("Inference request not found")]
    InferenceNotFound,
    #[msg("Compute node not found")]
    NodeNotFound,
    #[msg("Global state not initialized")]
    NotInitialized,
}
