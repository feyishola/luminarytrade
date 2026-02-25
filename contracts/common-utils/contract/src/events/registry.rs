use std::collections::HashMap;
use soroban_sdk::Symbol;

pub struct EventSchemaRegistry {
    schemas: HashMap<String, String>, // event_name -> schema JSON
}

impl EventSchemaRegistry {
    pub fn new() -> Self {
        Self { schemas: HashMap::new() }
    }

    pub fn register(&mut self, event_name: &str, schema: &str) {
        self.schemas.insert(event_name.to_string(), schema.to_string());
    }

    pub fn get(&self, event_name: &str) -> Option<&String> {
        self.schemas.get(event_name)
    }
}
