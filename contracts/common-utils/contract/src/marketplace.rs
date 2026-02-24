use soroban_sdk::{contract, contractimpl, Address, Env, token, contracttype, symbol_short};
use crate::error::CommonError;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ListingType {
    FixedPrice = 1,
    Auction = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub seller: Address,
    pub asset_address: Address,
    pub price: i128,
    pub currency: Address,
    pub listing_type: ListingType,
    pub royalty_bps: u32,
    pub royalty_recipient: Address,
}

#[contracttype]
pub enum DataKey {
    Listing(u64),
}

#[contract]
pub struct MarketplaceContract;

#[contractimpl]
impl MarketplaceContract {
    
    pub fn list_agent(
        env: Env,
        seller: Address,
        agent_id: u64,           
        asset_address: Address,  
        price: i128,             
        currency: Address,       
        listing_type: ListingType, 
        royalty_bps: u32,        
        royalty_recipient: Address
    ) -> Result<(), CommonError> {
        seller.require_auth();

        let token_client = token::Client::new(&env, &asset_address);
        token_client.transfer(&seller, &env.current_contract_address(), &1i128);

        let listing = Listing {
            seller,
            asset_address,
            price,
            currency,
            listing_type,
            royalty_bps,
            royalty_recipient,
        };

        let key = DataKey::Listing(agent_id);
        env.storage().persistent().set(&key, &listing);

        env.events().publish(
            (symbol_short!("listed"), agent_id),
            price
        );
        
        Ok(())
    }

    pub fn buy_agent(env: Env, buyer: Address, agent_id: u64) -> Result<(), CommonError> {
        buyer.require_auth();

        let key = DataKey::Listing(agent_id);
        let listing: Listing = env.storage().persistent().get(&key).ok_or(CommonError::KeyNotFound)?;

        let royalty_amount = (listing.price * (listing.royalty_bps as i128)) / 10000;
        let seller_amount = listing.price - royalty_amount;

        let currency_client = token::Client::new(&env, &listing.currency);
        
        if seller_amount > 0 {
            currency_client.transfer(&buyer, &listing.seller, &seller_amount);
        }
        if royalty_amount > 0 {
            currency_client.transfer(&buyer, &listing.royalty_recipient, &royalty_amount);
        }

        let agent_token_client = token::Client::new(&env, &listing.asset_address);
        agent_token_client.transfer(&env.current_contract_address(), &buyer, &1i128);

        env.storage().persistent().remove(&key);

        env.events().publish(
            (symbol_short!("sold"), agent_id),
            listing.price
        );
        
        Ok(())
    }
}
