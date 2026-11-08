use std::path::Path;
use std::thread;
use std::time::Duration;

pub(crate) fn remove_test_data_dir(path: &Path, label: &str) {
    const MAX_ATTEMPTS: usize = 20;

    for attempt in 1..=MAX_ATTEMPTS {
        match std::fs::remove_dir_all(path) {
            Ok(()) => return,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
            Err(_) if attempt < MAX_ATTEMPTS => thread::sleep(Duration::from_millis(100)),
            Err(error) => panic!("{label}: {error}"),
        }
    }
}
