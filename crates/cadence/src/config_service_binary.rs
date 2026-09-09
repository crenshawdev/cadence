// The executable owns tests for its local config and import types.
include!("config_service.rs");

#[cfg(test)]
include!("config_service_tests.rs");
