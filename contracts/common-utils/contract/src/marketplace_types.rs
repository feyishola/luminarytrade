use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ListingType {
    Sale,
    Lease,
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
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Listing(u64), 
    Admin,
}
