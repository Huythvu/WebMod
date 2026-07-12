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
- **Built-in helper API** — scripts receive a `webmod` object with DOM, UI, storage, and utility helpers (see below) so you write far less boilerplate.
- **Per-profile persistent storage** — isolated key/value store the script reads and writes at runtime (`await webmod.storage.set/get`), seeded from the Storage tab.
- **Import / Export / Backup** — save a single profile or back up all profiles as JSON, and re-import them.
- **Popup** — see which profiles match the current tab, toggle them, **create a profile pre-targeted at the current site** in one click, and **pause all** customizations globally.

## Built-in helper API

Your JavaScript runs as an async function (top-level `await` works) and receives `webmod` as its first argument:

```js
// Wait for an element, then add a button that persists a counter across reloads.
const bar = await webmod.waitFor('#header')
const count = (await webmod.storage.get('clicks')) || 0
const btn = webmod.create('button', { text: `Clicked ${count}`, onclick: async () => {
  const n = ((await webmod.storage.get('clicks')) || 0) + 1
  await webmod.storage.set('clicks', n)
  webmod.toast(`Saved: ${n}`, { type: 'success' })
} })
bar.appendChild(btn)
```

| Group | Helpers |
|---|---|
| **DOM** | `$`, `$$`, `waitFor`, `onMutation`, `create`, `injectCSS`, `injectHTML`, `onReady` |
| **UI** | `toast`, `modal`, `dialog` (shadow-root isolated) + the component library under `ui.*` (below) |
| **Storage** | `storage.get/set/remove/keys/getAll/clear` (async, persistent, per-profile) |
| **Utils** | `log`/`warn`/`error`, `sleep`, `debounce`, `throttle`, `download`, `clipboard`, `url` |
| **Context** | `id`, `name`, `settings` (read-only, from the Settings tab) |

### Component library (`webmod.ui.*`)

Prebuilt, styled UI components so scripts don't rebuild common pieces. Static components return a DOM `Element` you place anywhere; interactive ones return a small controller. The editor's **Insert component** menu (JS tab) drops in starter snippets.

```js
webmod.ui.toolbar({ items: [{ text: 'Hide ads', onClick: () => webmod.injectCSS('.ad{display:none}') }] })
const t = webmod.ui.table({ columns: ['Name', 'Age'], rows: [['Alice', 30], ['Bob', 25]] })
document.body.appendChild(t.element)
```

| Returns `Element` | Returns `{ element, ... }` controller |
|---|---|
| `button`, `card`, `searchBox`, `dropdown`, `checkbox` | `toolbar {remove}`, `sidebar {open,close,toggle,remove}`, `tabs {select}`, `accordion`, `table {setRows}`, `progress {set}` |

Components render as normal DOM with `wm-`-prefixed classes and a shared stylesheet (dark theme). Unlike the shadow-isolated `toast`/`modal`/`dialog`, a page's own CSS *can* override them — scope or restyle as needed.

## How injection works (MV3)

MV3 content scripts run in an isolated world and can't run page-scoped JS. WebMod splits the work:

- The **content script** (`src/content/`) reads profiles from `chrome.storage.local`, matches the URL, and injects **CSS** (`<style>`) and **HTML** (DOM nodes) directly. It tracks injected nodes per profile so they can be cleanly removed on re-apply or disable. It also hosts the **storage bridge** that services the API's `webmod.storage` calls.
- For **JavaScript**, it messages the **background service worker** (`src/background/`), which uses `chrome.scripting.executeScript({ world: 'MAIN' })` to run your code in the page's real JS context (this also bypasses the page's CSP). The `webmod` helper API is built there (`src/background/user-runtime.js`); storage calls hop back to the content script over `window.postMessage`.

Because it customizes arbitrary sites, WebMod requests the `<all_urls>` host permission. Profiles only execute on pages that match their own rules, and the popup's **Pause all** toggle disables every profile at once.

## Project structure

```
src/
  manifest.config.js      MV3 manifest (via @crxjs/vite-plugin)
  background/             service worker (live re-apply broadcast) + user-runtime.js (webmod API)
  content/                content script, injection engine (CSS/HTML), storage bridge
  lib/                    storage, URL matcher, profile schema/validation, messaging
  options/                Vue dashboard + CodeMirror editor
  popup/                  Vue popup (active profiles, quick toggles, create-for-site, pause-all)
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

1. Visit `https://example.com`, open the popup, and click **＋ New profile for example.com** — it creates a profile pre-targeted at the site and opens the editor.
2. Add CSS (`body { background: tomato }`), some HTML at *End of `<body>`*, and JS (`webmod.toast('hi from WebMod', { type: 'success' }); document.title = 'WebMod ✓'`).
3. Go back to the tab — the changes apply. Edit CSS in the dashboard and watch the open tab update live.

## Tech stack

Vue 3 · Vite · `@crxjs/vite-plugin` · CodeMirror 6 · Manifest V3.

## Roadmap

Deferred to future iterations: the full built-in helper API (DOM/UI/utility modules), a reusable component library, developer tools (element picker, DOM inspector, execution log), and cloud sync / profile sharing.
