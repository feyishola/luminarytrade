use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// Generic container for typed lists
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypedContainer<T> {
    items: Vec<T>,
}

impl<T> TypedContainer<T> {
    pub fn new() -> Self {
        Self { items: Vec::new() }
    }

    pub fn add(&mut self, item: T) {
        self.items.push(item);
    }

    pub fn all(&self) -> &Vec<T> {
        &self.items
    }

    pub fn into_vec(self) -> Vec<T> {
        self.items
    }
}

/// Key-value field wrapper for flexible named fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamedFields {
    fields: HashMap<String, String>,
}

impl NamedFields {
    pub fn new() -> Self {
        Self {
            fields: HashMap::new(),
        }
    }

    pub fn insert<K: Into<String>, V: Into<String>>(&mut self, key: K, value: V) {
        self.fields.insert(key.into(), value.into());
    }

    pub fn get(&self, key: &str) -> Option<&String> {
        self.fields.get(key)
    }

    pub fn all(&self) -> &HashMap<String, String> {
        &self.fields
    }
}

/// Event wrapper to emit strongly typed events
pub struct Event<T> {
    pub topic: String,
    pub payload: T,
}

impl<T> Event<T> {
    pub fn new(topic: &str, payload: T) -> Self {
        Self {
            topic: topic.to_string(),
            payload,
        }
    }
}