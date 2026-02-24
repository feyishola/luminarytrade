//! Reusable parsing framework for contract metadata
//! 
//! This module provides a generic parsing framework that separates
//! validation concerns from parsing logic, making it reusable across
//! multiple contracts.

pub mod traits;
pub mod metadata_parser;
pub mod builder;
pub mod config;

pub use traits::{Parser, ParseResult};
pub use metadata_parser::MetadataParser;
pub use builder::MetadataBuilder;
pub use config::ParserConfig;

#[cfg(test)]
mod tests;
