//! Bounded exponential backoff for transient sync HTTP failures.

use std::time::Duration;

use tokio::time::sleep;

pub(crate) const MAX_STEP_RETRIES: u32 = 5;
pub(crate) const INITIAL_BACKOFF_MS: u64 = 1000;
pub(crate) const MAX_BACKOFF_MS: u64 = 60_000;

pub(crate) fn backoff_delay_ms(attempt: u32) -> u64 {
    let exp = INITIAL_BACKOFF_MS.saturating_mul(2u64.saturating_pow(attempt));
    exp.min(MAX_BACKOFF_MS)
}

pub(crate) fn http_status_transient(status: u16) -> bool {
    matches!(status, 502 | 503 | 504)
}

pub(crate) async fn sleep_backoff(attempt: u32) {
    sleep(Duration::from_millis(backoff_delay_ms(attempt))).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_exponential_then_caps() {
        assert_eq!(backoff_delay_ms(0), INITIAL_BACKOFF_MS);
        assert_eq!(backoff_delay_ms(1), 2000);
        assert_eq!(backoff_delay_ms(2), 4000);
        assert_eq!(backoff_delay_ms(100), MAX_BACKOFF_MS);
    }

    #[test]
    fn transient_status_matches_synkronus_gateways() {
        assert!(http_status_transient(502));
        assert!(http_status_transient(503));
        assert!(http_status_transient(504));
        assert!(!http_status_transient(401));
    }
}
