# Contract Upgrade Mechanism

This module implements a proxy/registry pattern for upgradeable Soroban smart contracts, allowing you to replace contract implementations without losing state.

## Architecture

The upgrade mechanism consists of three main components:

### 1. Upgrade Registry (`upgrade_registry.rs`)
- Stores mappings between contract names and their current implementations
- Tracks version numbers and deployment timestamps
- Only accessible by admin for registering new implementations
- Provides querying capabilities for current implementations

### 2. Upgradeable Proxy (`upgrade_proxy.rs`)
- Forwards all calls to the current implementation stored in the registry
- Handles the upgrade process through admin authorization
- Maintains configuration (registry address, contract name, admin)
- Provides convenience methods for common operations

### 3. Implementation Contracts
- Actual business logic contracts that can be upgraded
- Maintain their own state independently
- Can be swapped out through the registry without data loss

## Key Features

✅ **State Preservation**: Contract state is maintained during upgrades  
✅ **Admin Control**: Only authorized admins can perform upgrades  
✅ **Version Tracking**: Automatic version numbering and deployment tracking  
✅ **Event Logging**: Comprehensive events for all upgrade operations  
✅ **Flexible Design**: Works with any contract that follows the pattern  

## Usage Guide

### 1. Deploy the Registry

```rust
// Deploy registry contract
let registry_address = env.register_contract(None, UpgradeRegistry);
UpgradeRegistry::initialize(env.clone(), admin_address);
```

### 2. Deploy Initial Implementation

```rust
// Deploy your implementation contract
let impl_v1_address = env.register_contract(None, YourImplementationContract);
YourImplementationContract::initialize(env.clone(), /* init params */);

// Register in registry
UpgradeRegistry::register_implementation(
    env.clone(),
    admin_address,
    Symbol::new(&env, "your_contract_name"),
    impl_v1_address,
    1, // version
);
```

### 3. Deploy the Proxy

```rust
// Deploy proxy contract
let proxy_address = env.register_contract(None, UpgradeableProxy);
UpgradeableProxy::initialize(
    env.clone(),
    registry_address,
    Symbol::new(&env, "your_contract_name"),
    admin_address,
);
```

### 4. Interact Through Proxy

All interactions should go through the proxy:

```rust
// Call functions through proxy
let args = vec![&env, param1.into(), param2.into()];
let result: ReturnType = env.invoke_contract(&proxy_address, &function_name, args);
```

### 5. Upgrade to New Implementation

```rust
// Deploy new implementation
let impl_v2_address = env.register_contract(None, YourUpgradedImplementation);
YourUpgradedImplementation::initialize(/* init params */);

// Perform upgrade through proxy
let upgrade_args = vec![&env, admin_address.into(), impl_v2_address.into()];
env.invoke_contract::<()>(&proxy_address, &Symbol::new(&env, "upgrade"), upgrade_args);
```

## Security Considerations

### Admin Authorization
- Only the designated admin can register new implementations
- Upgrade operations require admin signature
- Proxy configuration is immutable after initialization

### Best Practices
1. **Thorough Testing**: Test new implementations extensively before deployment
2. **Gradual Rollout**: Consider deploying to testnet first
3. **Backup Plans**: Have rollback procedures in case of issues
4. **Monitoring**: Watch for upgrade events and unusual activity

## Example Implementation

See `example_impl.rs` and `example_impl_v2.rs` for complete examples showing:
- Basic counter functionality in V1
- Enhanced counter with max value and reset tracking in V2
- State preservation during upgrade
- New feature addition without breaking existing functionality

## Running Tests

```bash
cargo test
```

The test suite includes:
- Unit tests for registry functionality
- Unit tests for proxy operations  
- Integration tests demonstrating complete upgrade workflows
- Security tests for unauthorized access prevention

## Event Reference

### Registry Events
- `registered_impl`: Emitted when new implementation is registered
  - Data: (contract_name, implementation_address, version)

### Proxy Events
- `upgraded`: Emitted when contract is upgraded
  - Data: (contract_name, new_implementation, new_version)

## Error Handling

The system uses custom error types:
- `ProxyError::RegistryNotSet`: Registry address not configured
- `ProxyError::ImplementationNotFound`: No implementation registered
- `ProxyError::CallFailed`: Forwarded call failed
- `ProxyError::UnauthorizedUpgrade`: Non-admin attempted upgrade

## Migration Guide

To make existing contracts upgradeable:

1. Deploy the registry and proxy contracts
2. Deploy your existing contract as the first implementation
3. Register it in the registry
4. Update your frontend/backend to interact through the proxy
5. Future upgrades only require deploying new implementations and calling upgrade

## Limitations

- All implementations must maintain compatible external interfaces
- Storage layout changes require careful consideration
- Gas costs include proxy forwarding overhead
- Admin key management is critical for security

## Future Enhancements

- Multi-signature upgrade approvals
- Timelocked upgrades
- Automated rollback mechanisms
- Upgrade scheduling
- Compatibility checking tools