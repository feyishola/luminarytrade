#![no_std]

/// Macro for decorator-style permission checks
/// 
/// # Usage
/// ```
/// #[authorize(Admin)]
/// pub fn admin_only_function(env: Env, caller: Address) -> Result<(), ContractError> {
///     // Function body - only accessible to admins
/// }
/// 
/// #[authorize(Reporter)]
/// pub fn reporter_function(env: Env, caller: Address) -> Result<(), ContractError> {
///     // Function body - only accessible to reporters
/// }
/// 
/// #[authorize(Any([Admin, Reporter]))]
/// pub fn admin_or_reporter_function(env: Env, caller: Address) -> Result<(), ContractError> {
///     // Function body - accessible to admins or reporters
/// }
/// 
/// #[authorize(All([Admin, Reporter]))]
/// pub fn admin_and_reporter_function(env: Env, caller: Address) -> Result<(), ContractError> {
///     // Function body - requires both admin and reporter roles
/// }
/// ```
#[macro_export]
macro_rules! authorize {
    ($permission:expr) => {
        #[allow(unused_variables)]
        fn __check_authorization(env: &soroban_sdk::Env, caller: &soroban_sdk::Address, auth: &dyn $crate::authorization::IAuthorizable) -> Result<(), $crate::error::ContractError> {
            let permission = $permission;
            auth.require_permission(env, caller, &permission)
        }
    };
}

/// Macro for creating authorization checks with custom auth instances
/// 
/// # Usage
/// ```
/// let auth = RoleBasedAuth::new(
///     Symbol::new(&env, "admin"),
///     Symbol::new(&env, "role")
/// );
/// 
/// with_auth!(auth, env, caller, Reporter, {
///     // Protected code block
/// });
/// ```
#[macro_export]
macro_rules! with_auth {
    ($auth:expr, $env:expr, $caller:expr, $permission:expr, $block:block) => {
        {
            let permission = $permission;
            $auth.require_permission($env, $caller, &permission)?;
            $block
        }
    };
}

/// Macro for creating composite authorization checks
/// 
/// # Usage
/// ```
/// let admin_auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
/// let role_auth = RoleBasedAuth::new(Symbol::new(&env, "admin"), Symbol::new(&env, "role"));
/// 
/// let composite = CompositeAuth::new_all(vec![
///     Box::new(admin_auth),
///     Box::new(role_auth)
/// ]);
/// 
/// require_auth!(composite, env, caller, Admin);
/// ```
#[macro_export]
macro_rules! require_auth {
    ($auth:expr, $env:expr, $caller:expr, $permission:expr) => {
        $auth.require_permission($env, $caller, &$permission)?;
    };
}

/// Macro for creating permission instances
/// 
/// # Usage
/// ```
/// let admin_perm = permission!(Admin);
/// let reporter_perm = permission!(Reporter);
/// let custom_perm = permission!(Custom("my_permission"));
/// let all_perm = permission!(All([Admin, Reporter]));
/// let any_perm = permission!(Any([Admin, Viewer]));
/// ```
#[macro_export]
macro_rules! permission {
    (Admin) => {
        $crate::authorization::Permission::Admin
    };
    (Reporter) => {
        $crate::authorization::Permission::Reporter
    };
    (Viewer) => {
        $crate::authorization::Permission::Viewer
    };
    (Custom($sym:expr)) => {
        $crate::authorization::Permission::Custom($sym)
    };
    (All([$($perm:expr),*])) => {
        $crate::authorization::Permission::All(vec![$($perm),*])
    };
    (Any([$($perm:expr),*])) => {
        $crate::authorization::Permission::Any(vec![$($perm),*])
    };
}

/// Macro for creating authorization instances
/// 
/// # Usage
/// ```
/// let admin_auth = auth!(AdminOnly, "admin_key");
/// let role_auth = auth!(RoleBased, "admin_key", "role_prefix");
/// let sig_auth = auth!(SignatureBased, "pubkey_key");
/// ```
#[macro_export]
macro_rules! auth {
    (AdminOnly, $admin_key:expr) => {
        $crate::authorization::AdminOnlyAuth::new($admin_key)
    };
    (RoleBased, $admin_key:expr, $role_prefix:expr) => {
        $crate::authorization::RoleBasedAuth::new($admin_key, $role_prefix)
    };
    (SignatureBased, $pubkey_key:expr) => {
        $crate::authorization::SignatureBasedAuth::new($pubkey_key)
    };
}

/// Macro for creating cached authorization instances
/// 
/// # Usage
/// ```
/// let auth = auth!(RoleBased, "admin", "role");
/// let cache = PermissionCache::new(300, Symbol::new(&env, "auth_cache"));
/// let cached_auth = cached_auth!(auth, cache);
/// ```
#[macro_export]
macro_rules! cached_auth {
    ($auth:expr, $cache:expr) => {
        $crate::authorization::CachedAuth::new($auth, $cache)
    };
}

/// Macro for implementing authorization in contract methods
/// 
/// # Usage
/// ```
/// impl MyContract {
///     #[contract_method]
///     pub fn protected_method(env: Env, caller: Address) -> Result<(), ContractError> {
///         let auth = Self::get_auth(&env);
///         check_authorization!(auth, env, caller, Admin);
///         
///         // Method implementation
///         Ok(())
///     }
/// }
/// ```
#[macro_export]
macro_rules! check_authorization {
    ($auth:expr, $env:expr, $caller:expr, $permission:expr) => {
        $auth.require_permission($env, $caller, &$permission)?;
    };
}

/// Macro for signature-based authorization checks
/// 
/// # Usage
/// ```
/// let auth = SignatureBasedAuth::new(Symbol::new(&env, "bridge_pubkey"));
/// verify_signature!(auth, env, payload, signature)?;
/// ```
#[macro_export]
macro_rules! verify_signature {
    ($auth:expr, $env:expr, $payload:expr, $signature:expr) => {
        {
            if !$auth.verify_signature($env, $payload, $signature)? {
                return Err($crate::error::ContractError::Unauthorized);
            }
        }
    };
}

/// Macro for role management in role-based auth
/// 
/// # Usage
/// ```
/// let auth = RoleBasedAuth::new(admin_key, role_prefix);
/// 
/// // Grant a role
/// grant_role!(auth, env, address, Reporter);
/// 
/// // Revoke a role
/// revoke_role!(auth, env, address, Reporter);
/// 
/// // Check if has role
/// let has_role = has_role!(auth, env, address, Reporter);
/// ```
#[macro_export]
macro_rules! grant_role {
    ($auth:expr, $env:expr, $address:expr, $role:expr) => {
        $auth.set_role($env, $address, &$role, true);
    };
}

#[macro_export]
macro_rules! revoke_role {
    ($auth:expr, $env:expr, $address:expr, $role:expr) => {
        $auth.set_role($env, $address, &$role, false);
    };
}

#[macro_export]
macro_rules! has_role {
    ($auth:expr, $env:expr, $address:expr, $role:expr) => {
        $auth.has_role($env, $address, &$role)
    };
}
