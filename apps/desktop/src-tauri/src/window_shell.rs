//! Window lifetime only: no client, credential or deployment operations.
use crate::window_preferences::{CloseAction, WindowPreferences};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBehavior {
    close_to_tray: bool,
    tray_available: bool,
    close_action: CloseAction,
    preferences_available: bool,
}

pub struct WindowShellState {
    preferences: Mutex<WindowPreferences>,
    #[cfg(target_os = "windows")]
    locale: Mutex<TrayLocale>,
}

impl WindowShellState {
    pub fn open() -> Self {
        Self {
            preferences: Mutex::new(WindowPreferences::open()),
            #[cfg(target_os = "windows")]
            locale: Mutex::new(TrayLocale::English),
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
pub enum TrayLocale {
    #[serde(rename = "en")]
    English,
    #[serde(rename = "zh-CN")]
    SimplifiedChinese,
}

#[cfg(any(target_os = "windows", test))]
fn menu_labels(locale: TrayLocale) -> (&'static str, &'static str) {
    match locale {
        TrayLocale::English => ("Open main window", "Exit CopilotBYOKManager"),
        TrayLocale::SimplifiedChinese => ("打开主窗口", "退出 CopilotBYOKManager"),
    }
}

#[cfg(any(feature = "local-e2e", test))]
pub fn isolated_instance_identifier(root: &std::path::Path) -> String {
    use sha2::{Digest, Sha256};
    let digest = format!("{:x}", Sha256::digest(root.to_string_lossy().as_bytes()));
    format!(
        "io.github.avalonero.copilotbyokmanager.local-validation.{}",
        &digest[..24]
    )
}

#[cfg(any(target_os = "windows", test))]
const TRAY_ID: &str = "copilot-byok-manager-tray";

#[cfg(any(target_os = "windows", test))]
#[derive(Debug, PartialEq, Eq)]
enum TrayAction {
    Restore,
    Quit,
}

#[cfg(any(target_os = "windows", test))]
fn menu_action(id: &str) -> Option<TrayAction> {
    match id {
        "copilot-byok-manager-show" => Some(TrayAction::Restore),
        "copilot-byok-manager-quit" => Some(TrayAction::Quit),
        _ => None,
    }
}

#[cfg(any(target_os = "windows", test))]
fn hide_on_close(
    label: &str,
    action: CloseAction,
    tray_ready: bool,
    hide: impl FnOnce() -> bool,
) -> bool {
    label == "main" && action == CloseAction::Tray && tray_ready && hide()
}

#[cfg(target_os = "windows")]
pub fn restore<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        // Restored windows must behave normally on the taskbar when minimized.
        let _ = window.set_skip_taskbar(false);
        if window
            .show()
            .and_then(|()| window.unminimize())
            .and_then(|()| window.set_focus())
            .is_err()
        {
            log::warn!("Could not restore the main window from the tray");
        }
    }
}

#[cfg(target_os = "windows")]
fn tray_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    locale: TrayLocale,
) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    let (show_label, quit_label) = menu_labels(locale);
    let show = MenuItem::with_id(
        app,
        "copilot-byok-manager-show",
        show_label,
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(
        app,
        "copilot-byok-manager-quit",
        quit_label,
        true,
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    Menu::with_items(app, &[&show, &separator, &quit])
}

pub fn initialize<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    #[cfg(target_os = "windows")]
    {
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
        // Never intercept close without a usable icon and recovery entry point.
        let Some(icon) = _app.default_window_icon().cloned() else {
            return Ok(());
        };
        let menu = tray_menu(_app, TrayLocale::English)?;
        TrayIconBuilder::with_id(TRAY_ID)
            .icon(icon)
            .tooltip(if cfg!(feature = "local-e2e") {
                "CopilotBYOKManager — ISOLATED VALIDATION"
            } else {
                "CopilotBYOKManager"
            })
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| match menu_action(event.id().as_ref()) {
                Some(TrayAction::Restore) => restore(app),
                // Tauri's normal exit lifecycle, not forced process termination.
                Some(TrayAction::Quit) => app.exit(0),
                None => {}
            })
            .on_tray_icon_event(|tray, event| {
                if matches!(
                    event,
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                ) {
                    restore(tray.app_handle());
                }
            })
            .build(_app)?;
    }
    Ok(())
}

pub fn on_window_event<R: tauri::Runtime>(_window: &tauri::Window<R>, _event: &tauri::WindowEvent) {
    #[cfg(target_os = "windows")]
    if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
        if _window.label() != "main" {
            return;
        }
        let action = _window
            .try_state::<WindowShellState>()
            .and_then(|state| {
                state
                    .preferences
                    .lock()
                    .ok()
                    .map(|preferences| preferences.close_action())
            })
            .unwrap_or(CloseAction::Exit);
        if hide_on_close(
            _window.label(),
            action,
            _window.app_handle().tray_by_id(TRAY_ID).is_some(),
            || _window.hide().is_ok(),
        ) {
            api.prevent_close();
        } else {
            // Exit the application, not just the last window behind a live tray.
            api.prevent_close();
            _window.app_handle().exit(0);
        }
    }
}

#[tauri::command]
pub fn get_window_behavior(app: tauri::AppHandle) -> WindowBehavior {
    #[cfg(target_os = "windows")]
    let tray_available = app.tray_by_id(TRAY_ID).is_some();
    #[cfg(not(target_os = "windows"))]
    let tray_available = false;
    let state = app.state::<WindowShellState>();
    let (close_action, preferences_available) = state
        .preferences
        .lock()
        .map(|preferences| (preferences.close_action(), preferences.available()))
        .unwrap_or((CloseAction::Exit, false));
    WindowBehavior {
        close_to_tray: tray_available && close_action == CloseAction::Tray,
        tray_available,
        close_action,
        preferences_available,
    }
}

#[tauri::command]
pub fn set_close_action(
    app: tauri::AppHandle,
    action: CloseAction,
) -> Result<WindowBehavior, String> {
    if action == CloseAction::Tray && !get_window_behavior(app.clone()).tray_available {
        return Err(crate::redact::redact_text(
            "System tray unavailable; window preference was not changed",
        ));
    }
    {
        let state = app.state::<WindowShellState>();
        let mut preferences = state
            .preferences
            .lock()
            .map_err(|_| crate::redact::redact_text("Window preferences are unavailable"))?;
        preferences
            .set(action)
            .map_err(|_| crate::redact::redact_text("Window preference could not be saved; the previous choice is unchanged. Refresh or restart to check the preference file"))?;
    }
    Ok(get_window_behavior(app))
}

/// Presentation-only: typed labels, no persistence or client/account operations.
#[tauri::command]
pub fn set_tray_locale(app: tauri::AppHandle, locale: TrayLocale) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let state = app.state::<WindowShellState>();
        let mut current = state
            .locale
            .lock()
            .map_err(|_| crate::redact::redact_text("Tray language is unavailable"))?;
        let menu = tray_menu(&app, locale)
            .map_err(|_| crate::redact::redact_text("Tray language is unavailable"))?;
        tray.set_menu(Some(menu))
            .map_err(|_| crate::redact::redact_text("Tray language is unavailable"))?;
        *current = locale;
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (app, locale);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn only_main_close_with_a_ready_tray_can_hide() {
        for (label, ready) in [("other", true), ("main", false)] {
            let called = Cell::new(false);
            assert!(!hide_on_close(label, CloseAction::Tray, ready, || {
                called.set(true);
                true
            }));
            assert!(!called.get());
        }
        assert!(hide_on_close("main", CloseAction::Tray, true, || true));
        assert!(!hide_on_close("main", CloseAction::Tray, true, || false));
    }

    #[test]
    fn close_failure_never_prevents_normal_exit() {
        let attempts = Cell::new(0);
        assert!(!hide_on_close("main", CloseAction::Tray, true, || {
            attempts.set(attempts.get() + 1);
            false
        }));
        assert_eq!(attempts.get(), 1);
    }

    #[test]
    fn tray_commands_are_fixed_and_quit_is_distinct_from_hiding() {
        assert_eq!(
            menu_action("copilot-byok-manager-show"),
            Some(TrayAction::Restore)
        );
        assert_eq!(
            menu_action("copilot-byok-manager-quit"),
            Some(TrayAction::Quit)
        );
        for value in ["", "quit", "../main", "copilot-byok-manager-show;exit"] {
            assert_eq!(menu_action(value), None);
        }
        assert_eq!(TRAY_ID, "copilot-byok-manager-tray");
    }

    #[test]
    fn unavailable_tray_is_reported_without_fabricated_success() {
        let value = serde_json::to_value(WindowBehavior {
            close_to_tray: false,
            tray_available: false,
            close_action: CloseAction::Tray,
            preferences_available: true,
        })
        .unwrap();
        assert_eq!(
            value,
            serde_json::json!({ "closeToTray": false, "trayAvailable": false, "closeAction": "tray", "preferencesAvailable": true })
        );
    }

    #[test]
    fn explicit_exit_never_hides_even_with_a_working_tray() {
        assert!(!hide_on_close("main", CloseAction::Exit, true, || {
            panic!("Exit must not call hide")
        }));
    }

    #[test]
    fn tray_labels_follow_only_the_two_supported_languages() {
        assert_eq!(
            menu_labels(TrayLocale::English),
            ("Open main window", "Exit CopilotBYOKManager")
        );
        assert_eq!(
            menu_labels(TrayLocale::SimplifiedChinese),
            ("打开主窗口", "退出 CopilotBYOKManager")
        );
        assert!(serde_json::from_str::<TrayLocale>("\"arbitrary\"").is_err());
        assert!(serde_json::from_str::<CloseAction>("\"tray;exit\"").is_err());
    }

    #[test]
    fn isolated_instances_never_wake_production_or_a_different_fixture() {
        let first = isolated_instance_identifier(std::path::Path::new("isolated-a"));
        assert_eq!(
            first,
            isolated_instance_identifier(std::path::Path::new("isolated-a"))
        );
        assert_ne!(
            first,
            isolated_instance_identifier(std::path::Path::new("isolated-b"))
        );
        assert_ne!(first, "io.github.avalonero.copilotbyokmanager");
        assert!(!first.contains("isolated-a"));
    }
}
