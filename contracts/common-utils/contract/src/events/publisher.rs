use soroban_sdk::Env;
use crate::events::DomainEvent;

pub struct EventPublisher<'a> {
    env: &'a Env,
}

impl<'a> EventPublisher<'a> {
    pub fn new(env: &'a Env) -> Self {
        Self { env }
    }

    pub fn publish<E: DomainEvent>(&self, event: &E) {
        self.env.events().publish(
            (event.name(), event.source()),
            (
                event.payload(),
                event.version(),
                event.timestamp(self.env),
            ),
        );
    }
}
