use crate::config::Config;

pub fn log_config_update(cfg: &Config) {
    println!("[CONFIG UPDATE] New configuration: {:?}", cfg);
}