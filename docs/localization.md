# Interface localization

CopilotBYOKManager supports English (`en`) and Simplified Chinese (`zh-CN`). The first launch chooses the first supported language in the system preference list; Chinese variants use Simplified Chinese, English variants use English, and other languages fall back to English. A valid saved choice overrides the system preference.

## User behavior

Use **Interface language / 界面语言** in the top bar. Only the bounded locale value is saved under `copilot-byok-manager.locale` in the app WebView/browser's local storage. Storage failure does not block the current switch; the UI warns that the preference could not be saved. No password, connection form, resource content or diagnostic is stored with that preference.

Switching redraws the current page without persisting native data or triggering client/account actions. On Windows the fixed tray labels are also updated through a presentation-only command. Retained extended UI supports preserving the selected Usage tab, applied filters, allowlisted unsaved filter fields, advanced-filter expansion and Token-summary expansion. An open form or deployment review prevents the switch; finish or close it first. Active publication additionally disables the selector. A language change must never consume, replace or apply a native plan.

Navigation, buttons, form help, statuses, dialogs, recovery warnings, Usage, Resources and accessibility labels use the message catalog. Dates use the selected locale; persisted timestamps and query ranges remain UTC. Monetary values remain exact decimal strings, not localized floating-point numbers.

The core edition exposes Overview / Providers / Apps / About (总览 / 供应商 / 应用 / 关于). Extended Usage/Resources translations remain but their pages are not mounted. Connection/client domain IDs and native command names are unchanged by user-facing labels.

Appearance offers System / Light / Dark (跟随系统 / 浅色 / 深色), saved separately under `copilot-byok-manager.appearance`. Only these values are accepted. Denied storage keeps the choice for this session. System changes apply only in System mode. Theme changes are CSS-only, including during a draft/reviewed preview: no field values are stored, no redraw occurs and no native command is called.

The Windows tray menu follows the selected interface language rather than mixing languages. A bounded presentation-only `set_tray_locale` command accepts `en` or `zh-CN`; it updates fixed native Open main window / Exit labels, with no file, credential, deployment or account operation. Initial labels use English until the frontend applies its saved/system choice. Rapid switches are coalesced, a failed label update leaves the window language intact, and locale is still persisted only in the existing browser preference. Browser preview never sends this command.

User-authored names, model identifiers, URLs, filesystem paths and original native/upstream diagnostics remain unchanged. Displaying a diagnostic in its original language is deliberate: do not translate arbitrary returned strings by matching their contents, and do not invent a translated error code or success state.

## Contributor contract

- Add each UI-owned message to `apps/desktop/web/i18n-messages.js` as `[Simplified Chinese, English]`. The source phrase is the explicit key; do not use remote or user-authored text as a key.
- Use `tr("key", parameter0, parameter1)` with `{0}`, `{1}` placeholders. Keep the same placeholders in both languages; never interpolate user data before lookup. Parameters are substituted once, never recursively translated.
- Keep markup in the renderer, not the catalog. Preserve HTML escaping of dynamic values for text and attributes. Prefer a complete sentence with placeholders over fragments when adding new messages.
- Module-level labels must resolve at render time, for example through getters; do not freeze the startup language in a constant string.
- Static shell text uses `data-i18n`; accessible names use `data-i18n-aria-label`. Locale values remain `en` and `zh-CN`, not translated strings.
- `npm run check:i18n` uses the development-only Acorn parser to check real JavaScript syntax, explicit catalog keys, placeholder parity and untranslated Chinese literals/templates. Acorn is not shipped or loaded by the app. English-only additions and translation quality also require review.
- `npm run check:web` includes locale selection/storage, prototype-safe lookup, non-recursive substitution, exact-money/unknown semantics, hostile input escaping and allowlisted draft preservation. The isolated browser suite additionally checks both languages, page navigation, form/plan guards, preference persistence and responsive layout.

To add another language, extend the bounded locale list and catalog schema, language selector, system fallback tests, static checker and browser scenarios together. A translated README alone does not constitute UI language support.
