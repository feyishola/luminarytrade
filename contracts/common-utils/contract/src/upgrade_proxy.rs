//! Upgradeable Proxy Contract
//! Forwards calls to the current implementation stored in the registry.

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, 
    Symbol, Val, Vec, symbol_short, IntoVal, vec
};
use crate::error::CommonError;
use crate::migration::MigrationRunner;

#[contracttype]
#[derive(Clone, Debug)]
pub struct ProxyConfig {
    pub registry: Address,
    pub contract_name: Symbol,
    pub admin: Address,
}

#[contract]
pub struct UpgradeableProxy;

#[contractimpl]
impl UpgradeableProxy {
    /// Initialize the proxy with registry and contract name
    pub fn initialize(env: Env, registry: Address, contract_name: Symbol, admin: Address) {
        if env.storage().instance().has(&symbol_short!("config")) {
            panic!("Already initialized");
        }
        let config = ProxyConfig {
            registry: registry.clone(),
            contract_name: contract_name.clone(),
            admin: admin.clone(),
        };
        env.storage().instance().set(&symbol_short!("config"), &config);
        
        // Emit initialization event
        env.events().publish(
            (symbol_short!("init"), contract_name),
            (registry, admin),
        );
    }

    /// Upgrade to a new implementation
    /// Only callable by admin
    pub fn upgrade(env: Env, admin: Address, new_implementation: Address) -> Result<(), CommonError> {
        let config: ProxyConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("config"))
            .expect("Proxy not initialized");

        // Verify admin authorization
        admin.require_auth();
        if config.admin != admin {
            return Err(CommonError::NotAuthorized);
        }

        let registry_client = UpgradeRegistryClient::new(&env, &config.registry);
        
        // 1. Lifecycle Hook: Pre-upgrade
        if let Some(current_impl) = registry_client.get_implementation(&config.contract_name) {
            // Optional: Call pre-upgrade hook on current implementation
            let _ = env.invoke_contract::<Val>(&current_impl, &Symbol::new(&env, "pre_upgrade_hook"), vec![&env]);
            
            // 2. Automated Migration
            // Run migration from current to new
            let _ = MigrationRunner::run_migration(&env, &current_impl, &new_implementation, &admin);
        }

        let info = registry_client.get_implementation_info(&config.contract_name);
        let current_version = info.map(|i| i.version).unwrap_or(0);

        // 3. Register in Registry
        registry_client.register_implementation(
            &admin,
            &config.contract_name,
            &new_implementation,
            &(current_version + 1),
            &None,
        );

        // 4. Lifecycle Hook: Post-upgrade
        let _ = env.invoke_contract::<Val>(&new_implementation, &Symbol::new(&env, "post_upgrade_hook"), vec![&env]);

        // Emit upgrade event
        env.events().publish(
            (symbol_short!("upgrade"), config.contract_name),
            (new_implementation, current_version + 1),
        );
        
        Ok(())
    }

    /// Rollback to a previous version
    /// Only callable by admin
    pub fn rollback(env: Env, admin: Address, target_version: u32) -> Result<(), CommonError> {
        let config: ProxyConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("config"))
            .expect("Proxy not initialized");

        // Verify admin authorization
        admin.require_auth();
        if config.admin != admin {
            return Err(CommonError::NotAuthorized);
        }

        let registry_client = UpgradeRegistryClient::new(&env, &config.registry);
        
        // Get target implementation info for hooks
        let target_info = registry_client.get_implementation_at_version(&config.contract_name, target_version)
            .ok_or(CommonError::ImplementationNotFound)?;

        // Call pre-upgrade hook on CURRENT implementation (before rollback)
        if let Some(current_impl) = registry_client.get_implementation(&config.contract_name) {
            let _ = env.invoke_contract::<Val>(&current_impl, &Symbol::new(&env, "pre_upgrade_hook"), vec![&env]);
        }

        // Perform rollback in registry
        registry_client.rollback(&admin, &config.contract_name, target_version);

        // Call post-upgrade hook on the ROLLED BACK implementation
        let _ = env.invoke_contract::<Val>(&target_info.implementation, &Symbol::new(&env, "post_upgrade_hook"), vec![&env]);

        // Emit rollback event
        env.events().publish(
            (symbol_short!("rollback"), config.contract_name),
            (target_info.implementation, target_version),
        );

        Ok(())
    }

    /// Forward a call to the current implementation
    pub fn forward_call(env: Env, function: Symbol, args: Vec<Val>) -> Result<Val, CommonError> {
        let config: ProxyConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("config"))
            .expect("Proxy not initialized");

        // Get current implementation from registry
        let registry_client = UpgradeRegistryClient::new(&env, &config.registry);
        let implementation = registry_client
            .get_implementation(&config.contract_name)
            .ok_or(CommonError::ImplementationNotFound)?;

        // Forward the call to implementation
        Ok(env.invoke_contract(&implementation, &function, args))
    }

    /// Get current implementation address
    pub fn get_implementation(env: Env) -> Result<Address, CommonError> {
        let config: ProxyConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("config"))
            .expect("Proxy not initialized");

        let registry_client = UpgradeRegistryClient::new(&env, &config.registry);
        registry_client
            .get_implementation(&config.contract_name)
            .ok_or(CommonError::ImplementationNotFound)
    }

    /// Get proxy configuration
    pub fn get_config(env: Env) -> ProxyConfig {
        env.storage()
            .instance()
            .get(&symbol_short!("config"))
            .expect("Proxy not initialized")
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        let config: ProxyConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("config"))
            .expect("Proxy not initialized");
        config.admin
    }
}

// Client for interacting with the registry
pub struct UpgradeRegistryClient<'a> {
    env: &'a Env,
    address: &'a Address,
}

impl<'a> UpgradeRegistryClient<'a> {
    pub fn new(env: &'a Env, address: &'a Address) -> Self {
        Self { env, address }
    }

    pub fn register_implementation(
        &self,
        admin: &Address,
        contract_name: &Symbol,
        implementation: &Address,
        version: &u32,
        migration_hash: &Option<soroban_sdk::BytesN<32>>,
    ) {
        let mut args: Vec<Val> = Vec::new(self.env);
        args.push_back(admin.to_val());
        args.push_back(contract_name.to_val());
        args.push_back(implementation.to_val());
        args.push_back((*version).into_val(self.env));
        args.push_back(migration_hash.into_val(self.env));
        
        self.env.invoke_contract::<Val>(
            self.address, 
            &Symbol::new(self.env, "register_implementation"), 
            args
        );
    }

    pub fn get_implementation(&self, contract_name: &Symbol) -> Option<Address> {
        let mut args: Vec<Val> = Vec::new(self.env);
        args.push_back(contract_name.to_val());
        
        self.env.invoke_contract(
            self.address,
            &Symbol::new(self.env, "get_implementation"),
            args,
        )
    }

    pub fn get_implementation_info(
        &self,
        contract_name: &Symbol,
    ) -> Option<crate::upgrade_registry::ImplementationInfo> {
        let mut args: Vec<Val> = Vec::new(self.env);
        args.push_back(contract_name.to_val());
        
        self.env.invoke_contract(
            self.address,
            &Symbol::new(self.env, "get_implementation_info"),
            args,
        )
    }

    pub fn get_implementation_at_version(
        &self,
        contract_name: &Symbol,
        version: u32,
    ) -> Option<crate::upgrade_registry::ImplementationInfo> {
        let mut args: Vec<Val> = Vec::new(self.env);
        args.push_back(contract_name.to_val());
        args.push_back(version.into_val(self.env));
        
        self.env.invoke_contract(
            self.address,
            &Symbol::new(self.env, "get_implementation_at_version"),
            args,
        )
    }

    pub fn rollback(&self, admin: &Address, contract_name: &Symbol, version: u32) {
        let mut args: Vec<Val> = Vec::new(self.env);
        args.push_back(admin.to_val());
        args.push_back(contract_name.to_val());
        args.push_back(version.into_val(self.env));
        
        self.env.invoke_contract::<Val>(
            self.address,
            &Symbol::new(self.env, "rollback"),
            args,
        );
    }
}