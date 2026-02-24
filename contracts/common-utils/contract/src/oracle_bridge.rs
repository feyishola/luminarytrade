use soroban_sdk::{
    contract, contractimpl, Address, Bytes, Env, 
    contracttype, symbol_short,
};
use crate::error::CommonError;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OracleRequest {
    pub id: u64,
    pub requester: Address,
    pub data_type: u32,
    pub params: Bytes,
    pub fulfilled: bool,
    pub result: Bytes,
    pub timestamp: u64,
}

#[contract]
pub struct OracleBridgeContract;

#[contractimpl]
impl OracleBridgeContract {
    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&symbol_short!("admin"), &admin);
        env.storage().instance().set(&symbol_short!("req_cnt"), &0u64);
    }

    pub fn add_oracle(env: Env, oracle: Address) -> Result<(), CommonError> {
        let admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        admin.require_auth();

        let key = (symbol_short!("oracle"), oracle.clone());
        if env.storage().persistent().has(&key) {
            return Err(CommonError::OracleAlreadyExists);
        }
        env.storage().persistent().set(&key, &true);
        Ok(())
    }

    pub fn request_data(env: Env, requester: Address, data_type: u32, params: Bytes) -> u64 {
        requester.require_auth();

        let counter: u64 = env.storage().instance().get(&symbol_short!("req_cnt")).unwrap_or(0);
        let request_id = counter + 1;

        let request = OracleRequest {
            id: request_id,
            requester: requester.clone(),
            data_type,
            params,
            fulfilled: false,
            result: Bytes::new(&env),
            timestamp: env.ledger().timestamp(),
        };

        let key = (symbol_short!("request"), request_id);
        env.storage().persistent().set(&key, &request);
        env.storage().instance().set(&symbol_short!("req_cnt"), &request_id);

        env.events().publish((symbol_short!("req_cre"),), (request_id, requester, data_type));

        request_id
    }

    pub fn fulfill_request(env: Env, oracle: Address, request_id: u64, result: Bytes) -> Result<(), CommonError> {
        oracle.require_auth();
        
        let oracle_key = (symbol_short!("oracle"), oracle.clone());
        if !env.storage().persistent().has(&oracle_key) {
             return Err(CommonError::NotAuthorized);
        }

        let req_key = (symbol_short!("request"), request_id);
        let mut request: OracleRequest = env.storage().persistent().get(&req_key).ok_or(CommonError::RequestNotFound)?;

        if request.fulfilled {
            return Err(CommonError::RequestAlreadyFulfilled);
        }

        request.fulfilled = true;
        request.result = result;
        
        env.storage().persistent().set(&req_key, &request);
        env.events().publish((symbol_short!("req_fil"),), (request_id, oracle));
        
        Ok(())
    }
    
    pub fn is_approved_oracle(env: Env, oracle: Address) -> bool {
         let key = (symbol_short!("oracle"), oracle);
         env.storage().persistent().has(&key)
    }
}
