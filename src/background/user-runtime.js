// The WebMod runtime. This whole function is injected into the page's MAIN world
// via chrome.scripting.executeScript, so it must be fully self-contained: it may
// only reference page globals (window, document, navigator, …) and its own nested
// helpers — never module-scope bindings.
//
// It builds the `webmod` helper API, then runs the user's code as an async IIFE
// (so top-level `await` — e.g. `await webmod.storage.get()` — works).

export function runUserCode(code, context, profileId) {
  const w = window
  const doc = document

  // --- Storage bridge (singleton): talk to the isolated-world content script ---
  if (!w.__webmodBridge) {
    const pending = new Map()
    let seq = 0
    w.addEventListener('message', (e) => {
      if (e.source !== w) return
      const d = e.data
      if (!d || d.source !== 'webmod-content' || d.id == null) return
      const p = pending.get(d.id)
      if (!p) return
      pending.delete(d.id)
      if (d.ok) p.resolve(d.result)
      else p.reject(new Error(d.error || 'WebMod storage error'))
    })
    w.__webmodBridge = function request(pid, op, key, value) {
      return new Promise((resolve, reject) => {
        const id = 'wm_' + Date.now().toString(36) + '_' + ++seq
        pending.set(id, { resolve, reject })
        w.postMessage({ source: 'webmod-page', id, profileId: pid, op, key, value }, '*')
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id)
            reject(new Error('WebMod storage timeout'))
          }
        }, 5000)
      })
    }
  }
  const bridge = w.__webmodBridge

  // --- Shared shadow-root host for UI, isolated from page CSS -----------------
  function uiRoot() {
    if (w.__webmodUiHost && w.__webmodUiHost.isConnected) return w.__webmodUiHost.shadowRoot
    const host = doc.createElement('div')
    host.setAttribute('data-webmod-ui', '')
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0;'
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<style>' +
      ":host{all:initial}" +
      ".wm-toasts{position:fixed;top:16px;right:16px;display:flex;flex-direction:column;gap:8px}" +
      ".wm-toast{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1e2128;color:#e6e8ee;padding:10px 14px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.35);font-size:13px;max-width:320px;animation:wm-in .18s ease}" +
      ".wm-toast.info{border-left:3px solid #4f7cff}.wm-toast.success{border-left:3px solid #37c05b}.wm-toast.error{border-left:3px solid #e5534b}.wm-toast.warn{border-left:3px solid #e0a83b}" +
      ".wm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
      ".wm-modal,.wm-dialog{position:relative;background:#1e2128;color:#e6e8ee;border-radius:12px;padding:20px;max-width:90vw;max-height:85vh;overflow:auto;box-shadow:0 12px 48px rgba(0,0,0,.5);min-width:300px}" +
      ".wm-x{position:absolute;top:10px;right:12px;cursor:pointer;color:#9aa1ad;background:none;border:none;font-size:18px}" +
      ".wm-dialog p{margin:0 0 16px}.wm-btns{display:flex;gap:8px;justify-content:flex-end}" +
      ".wm-btns button{background:#333844;color:#e6e8ee;border:none;border-radius:7px;padding:8px 14px;font-size:13px;cursor:pointer}.wm-btns button.primary{background:#4f7cff}" +
      "@keyframes wm-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}" +
      '</style><div class="wm-toasts"></div>'
    ;(doc.body || doc.documentElement).appendChild(host)
    w.__webmodUiHost = host
    return root
  }

  // --- DOM helpers ------------------------------------------------------------
  const $ = (sel, root) => (root || doc).querySelector(sel)
  const $$ = (sel, root) => Array.from((root || doc).querySelectorAll(sel))

  function waitFor(selector, timeout) {
    timeout = timeout || 10000
    return new Promise((resolve) => {
      const found = doc.querySelector(selector)
      if (found) return resolve(found)
      const obs = new MutationObserver(() => {
        const el = doc.querySelector(selector)
        if (el) {
          obs.disconnect()
          resolve(el)
        }
      })
      obs.observe(doc.documentElement, { childList: true, subtree: true })
      setTimeout(() => {
        obs.disconnect()
        resolve(doc.querySelector(selector))
      }, timeout)
    })
  }

  function onMutation(target, cb, opts) {
    const el = typeof target === 'string' ? doc.querySelector(target) : target
    if (!el) return () => {}
    const obs = new MutationObserver((m) => cb(m))
    obs.observe(el, opts || { childList: true, subtree: true })
    return () => obs.disconnect()
  }

  function create(tag, props, children) {
    const el = doc.createElement(tag)
    if (props)
      for (const k in props) {
        const v = props[k]
        if (k === 'style' && v && typeof v === 'object') Object.assign(el.style, v)
        else if (k === 'class' || k === 'className') el.className = v
        else if (k === 'text' || k === 'textContent') el.textContent = v
        else if (k === 'html' || k === 'innerHTML') el.innerHTML = v
        else if (k === 'dataset' && v && typeof v === 'object') Object.assign(el.dataset, v)
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
        else if (v === true) el.setAttribute(k, '')
        else if (v != null && v !== false) el.setAttribute(k, v)
      }
    if (children != null) {
      const arr = Array.isArray(children) ? children : [children]
      for (const c of arr) el.append(c && c.nodeType ? c : doc.createTextNode(String(c)))
    }
    return el
  }

  function injectCSS(css) {
    const style = doc.createElement('style')
    style.setAttribute('data-webmod-api', profileId)
    style.textContent = css
    ;(doc.head || doc.documentElement).appendChild(style)
    return { remove: () => style.remove(), element: style }
  }

  async function injectHTML(html, position, targetSel) {
    position = position || 'body-end'
    const wrap = doc.createElement('div')
    wrap.setAttribute('data-webmod-api', profileId)
    wrap.innerHTML = html
    const body = doc.body || (await waitFor('body'))
    if (position === 'body-start') body.insertBefore(wrap, body.firstChild)
    else if (position === 'before' || position === 'after' || position === 'inside') {
      const target = targetSel ? await waitFor(targetSel) : null
      if (!target) body.appendChild(wrap)
      else if (position === 'before') target.parentNode.insertBefore(wrap, target)
      else if (position === 'after') target.parentNode.insertBefore(wrap, target.nextSibling)
      else target.appendChild(wrap)
    } else body.appendChild(wrap)
    return wrap
  }

  const onReady = (fn) => {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn, { once: true })
    else fn()
  }

  // --- UI helpers -------------------------------------------------------------
  function toast(message, opts) {
    opts = opts || {}
    const root = uiRoot()
    const box = doc.createElement('div')
    box.className = 'wm-toast ' + (opts.type || 'info')
    box.textContent = message
    root.querySelector('.wm-toasts').appendChild(box)
    const ms = opts.duration == null ? 3000 : opts.duration
    if (ms) setTimeout(() => box.remove(), ms)
    return { dismiss: () => box.remove() }
  }

  function modal(content, opts) {
    opts = opts || {}
    const root = uiRoot()
    const overlay = doc.createElement('div')
    overlay.className = 'wm-overlay'
    const box = doc.createElement('div')
    box.className = 'wm-modal'
    if (typeof content === 'string') box.innerHTML = content
    else if (content && content.nodeType) box.appendChild(content)
    const x = doc.createElement('button')
    x.className = 'wm-x'
    x.textContent = '×'
    const close = () => overlay.remove()
    x.addEventListener('click', close)
    if (opts.closeOnBackdrop !== false)
      overlay.addEventListener('click', (e) => e.target === overlay && close())
    box.appendChild(x)
    overlay.appendChild(box)
    root.appendChild(overlay)
    return { close, element: box }
  }

  function dialog(message, opts) {
    opts = opts || {}
    const buttons = opts.buttons || [
      { label: 'Cancel', value: false },
      { label: 'OK', value: true, primary: true },
    ]
    const root = uiRoot()
    return new Promise((resolve) => {
      const overlay = doc.createElement('div')
      overlay.className = 'wm-overlay'
      const box = doc.createElement('div')
      box.className = 'wm-dialog'
      const p = doc.createElement('p')
      p.textContent = message
      const btns = doc.createElement('div')
      btns.className = 'wm-btns'
      const done = (val) => {
        overlay.remove()
        resolve(val)
      }
      buttons.forEach((b) => {
        const el = doc.createElement('button')
        el.textContent = b.label
        if (b.primary) el.className = 'primary'
        el.addEventListener('click', () => done(b.value))
        btns.appendChild(el)
      })
      box.appendChild(p)
      box.appendChild(btns)
      overlay.appendChild(box)
      root.appendChild(overlay)
    })
  }

  // --- Utilities --------------------------------------------------------------
  const tag = '[WebMod:' + (context.name || profileId) + ']'
  const log = (...a) => console.log(tag, ...a)
  const warn = (...a) => console.warn(tag, ...a)
  const error = (...a) => console.error(tag, ...a)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  function debounce(fn, ms) {
    let t
    return function (...args) {
      clearTimeout(t)
      t = setTimeout(() => fn.apply(this, args), ms)
    }
  }
  function throttle(fn, ms) {
    let last = 0
    return function (...args) {
      const now = Date.now()
      if (now - last >= ms) {
        last = now
        fn.apply(this, args)
      }
    }
  }

  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = doc.createElement('a')
    a.href = url
    a.download = filename || 'download'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const clipboard = {
    writeText: (text) => (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error('clipboard unavailable'))),
    readText: () => (navigator.clipboard ? navigator.clipboard.readText() : Promise.reject(new Error('clipboard unavailable'))),
  }

  const url = {
    current: () => location.href,
    host: () => location.hostname,
    path: () => location.pathname,
    param: (name) => new URLSearchParams(location.search).get(name),
    params: () => Object.fromEntries(new URLSearchParams(location.search).entries()),
  }

  const storage = {
    get: (key) => bridge(profileId, 'get', key),
    set: (key, value) => bridge(profileId, 'set', key, value),
    remove: (key) => bridge(profileId, 'remove', key),
    keys: () => bridge(profileId, 'keys'),
    getAll: () => bridge(profileId, 'getAll'),
    clear: () => bridge(profileId, 'clear'),
  }

  // --- Assemble the API and run the user's code -------------------------------
  const api = {
    id: profileId,
    name: context.name,
    settings: context.settings || {},
    storage,
    // DOM
    $,
    $$,
    waitFor,
    onMutation,
    create,
    injectCSS,
    injectHTML,
    onReady,
    // UI
    toast,
    modal,
    dialog,
    // utils
    log,
    warn,
    error,
    sleep,
    debounce,
    throttle,
    download,
    clipboard,
    url,
  }
  // Merge the reusable component library (injected separately into MAIN world).
  // Shadow-isolated primitives (toast/modal/dialog) stay available under ui too.
  api.ui = Object.assign({ toast, modal, dialog }, w.__webmodComponents || {})
  w.webmod = w.webmod || {}
  w.webmod[profileId] = api

  try {
    const runner = new Function('webmod', '"use strict";\nreturn (async () => {\n' + code + '\n})();')
    Promise.resolve(runner(api)).catch((err) => error('script error:', err))
  } catch (err) {
    error('script error:', err)
  }
}
