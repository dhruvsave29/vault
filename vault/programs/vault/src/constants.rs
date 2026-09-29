pub const GLOBAL_SEED: &[u8] = b"global";
pub const MODEL_SEED: &[u8] = b"model";
pub const INFERENCE_SEED: &[u8] = b"inference";
pub const NODE_SEED: &[u8] = b"node";
pub const SUBSCRIPTION_SEED: &[u8] = b"subscription";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const REPUTATION_SEED: &[u8] = b"reputation";
pub const OWNERSHIP_MINT_SEED: &[u8] = b"ownership_mint";
pub const PERMISSION_SEED: &[u8] = b"permission";

pub const MAX_CONTRIBUTORS: usize = 10;

pub const CONTRIBUTOR_BPS: u64 = 7000;
pub const NODE_BPS: u64 = 2500;
pub const PROTOCOL_BPS: u64 = 500;
pub const TOTAL_BPS: u64 = 10000;

pub const SUBSCRIPTION_DURATION_SECS: i64 = 30 * 24 * 60 * 60;

pub const MAX_IPFS_CID_LEN: usize = 64;
pub const MAX_FRAMEWORK_VERSION_LEN: usize = 16;
pub const MAX_ENDPOINT_URL_LEN: usize = 128;
pub const MAX_PAYMENT_SIG_LEN: usize = 88;

pub const GLOBAL_STATE_SIZE: usize = 8 + 1 + 8 + 8 + 32;
pub const MODEL_SIZE: usize = 8
    + 1
    + 8
    + 32
    + 32
    + (4 + MAX_IPFS_CID_LEN)
    + 32
    + 1
    + 1
    + (4 + MAX_FRAMEWORK_VERSION_LEN)
    + 2
    + 32
    + 8
    + 8
    + 1
    + 8
    + (4 + MAX_CONTRIBUTORS * 32)
    + (4 + MAX_CONTRIBUTORS * 2)
    + (4 + MAX_CONTRIBUTORS * 32)
    + (4 + MAX_CONTRIBUTORS * 8)
    + 8
    + 8
    + 4
    + 4
    + 4
    + 1
    + 8
    + 8
    + 32;
pub const INFERENCE_SIZE: usize = 8
    + 1
    + 32
    + 32
    + 32
    + 32
    + 32
    + 32
    + 8
    + (4 + MAX_PAYMENT_SIG_LEN)
    + 1
    + 4
    + 4
    + 4
    + 8
    + 4
    + 32
    + 1
    + 8
    + 8;
pub const NODE_SIZE: usize =
    8 + 1 + 32 + (4 + MAX_ENDPOINT_URL_LEN) + 8 + 8 + 8 + 4 + 4 + 32 + 2 + 4 + 1 + 8 + 8 + 8;
pub const SUBSCRIPTION_SIZE: usize = 8 + 1 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
pub const ESCROW_SIZE: usize = 8 + 1 + 8 + 8 + 32 + 8;
pub const REPUTATION_SIZE: usize = 8 + 1 + 32 + 4 + 8 + 8 + 8 + 4 + 8;
pub const PERMISSION_SIZE: usize = 8 + 1 + 32 + 1;

pub const STATUS_CREATED: u8 = 0;
pub const STATUS_PAID: u8 = 1;
pub const STATUS_NODE_ASSIGNED: u8 = 2;
pub const STATUS_COMPLETED: u8 = 3;
pub const STATUS_VERIFIED: u8 = 4;
pub const STATUS_DISPUTED: u8 = 5;

pub const DELEGATION_PROGRAM_ID: &str = "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
pub const PERMISSION_PROGRAM_ID: &str = "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
pub const ER_VALIDATOR_ASIA: &str = "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57";
pub const TEE_VALIDATOR: &str = "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo";
