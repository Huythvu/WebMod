# WebMod

Customize any website from one browser extension.

WebMod is a universal website customization platform for Chrome/Edge (Manifest V3). Instead of building a separate extension for every site, you create **profiles** — bundles of custom HTML, CSS, and JavaScript with URL match rules — that automatically load on matching pages.

```
youtube.com  →  inject HTML / CSS / JS   (profile A)
facebook.com →  inject different HTML / CSS / JS   (profile B)
```

Each profile is completely independent.

## Features (v1 — Core MVP)

- **Profiles** — create, edit, duplicate, enable/disable, and delete per-site customizations.
- **URL matching** — target by domain (+ subdomains), exact host, exact URL, glob pattern (`*`), or regular expression. A profile applies if **any** rule matches.
- **Injection** — custom **CSS**, custom **HTML** (at beginning/end of `<body>`, or before/after/inside a target selector), and custom **JavaScript** that runs in the page's real context.
- **Built-in editor** — CodeMirror 6 with per-language syntax highlighting (HTML/CSS/JS), undo/redo, search & replace, auto-save, and a light/dark theme.
- **Live development** — saving in the editor re-applies CSS/HTML to open matching tabs instantly (JS re-runs) — no reload or browser restart.
- **Settings & Storage tabs** — seed JSON data exposed to your script as `webmod.settings` / `webmod.storage`.
- **Import / Export / Backup** — save a single profile or back up all profiles as JSON, and re-import them.
- **Popup** — see which profiles match the current tab, toggle them, and **pause all** customizations globally.

## How injection works (MV3)

MV3 content scripts run in an isolated world and can't run page-scoped JS. WebMod splits the work:

- The **content script** (`src/content/`) reads profiles from `chrome.storage.local`, matches the URL, and injects **CSS** (`<style>`) and **HTML** (DOM nodes) directly. It tracks injected nodes per profile so they can be cleanly removed on re-apply or disable.
- For **JavaScript**, it messages the **background service worker** (`src/background/`), which uses `chrome.scripting.executeScript({ world: 'MAIN' })` to run your code in the page's real JS context (this also bypasses the page's CSP). Your code receives a small `webmod` helper (`settings`, `storage`, `log()`).

Because it customizes arbitrary sites, WebMod requests the `<all_urls>` host permission. Profiles only execute on pages that match their own rules, and the popup's **Pause all** toggle disables every profile at once.

## Project structure

```
src/
  manifest.config.js      MV3 manifest (via @crxjs/vite-plugin)
  background/             service worker — runs user JS in MAIN world, broadcasts live re-apply
  content/                content script + injection engine (CSS/HTML + cleanup registry)
  lib/                    storage, URL matcher, profile schema/validation, messaging
  options/                Vue dashboard + CodeMirror editor
  popup/                  Vue popup (active profiles, quick toggles, pause-all)
public/icons/             extension icons
```

## Development

```bash
npm install
npm run build     # outputs to dist/
```

Then load it in the browser:

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select the `dist/` folder.

`npm run dev` runs Vite with HMR for the dashboard/popup pages during development.

### Try it

1. Open the dashboard, create a profile matching `example.com` (domain rule).
2. Add CSS (`body { background: tomato }`), some HTML at *End of `<body>`*, and JS (`webmod.log('hi'); document.title = 'WebMod ✓'`).
3. Visit `https://example.com` — the changes apply. Edit CSS in the dashboard and watch the open tab update live.

## Tech stack

Vue 3 · Vite · `@crxjs/vite-plugin` · CodeMirror 6 · Manifest V3.

## Roadmap

Deferred to future iterations: the full built-in helper API (DOM/UI/utility modules), a reusable component library, developer tools (element picker, DOM inspector, execution log), and cloud sync / profile sharing.
