// A release app must not open a console whose close button can terminate it.
#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]

fn main() {
    copilot_byok_manager_lib::run();
}
