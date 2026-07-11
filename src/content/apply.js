// Injection engine (runs in the content script's ISOLATED world).
// Handles CSS + HTML injection with a per-profile cleanup registry, and
// delegates JS execution to the background service worker (MAIN world).

import { MSG, sendToBackground } from '../lib/messaging.js'

// profileId -> { styleEl, htmlRoot }
const applied = new Map()

/** Wait for an element to appear (up to `timeout` ms). Resolves null on timeout. */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector)
    if (existing) return resolve(existing)
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) {
        obs.disconnect()
        resolve(el)
      }
    })
    obs.observe(document.documentElement, { childList: true, subtree: true })
    setTimeout(() => {
      obs.disconnect()
      resolve(document.querySelector(selector))
    }, timeout)
  })
}

function injectCss(profile) {
  if (!profile.css || !profile.css.trim()) return null
  const style = document.createElement('style')
  style.setAttribute('data-webmod', profile.id)
  style.textContent = profile.css
  ;(document.head || document.documentElement).appendChild(style)
  return style
}

async function injectHtml(profile) {
  const html = profile.html || {}
  if (!html.code || !html.code.trim()) return null

  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-webmod', profile.id)
  wrapper.innerHTML = html.code

  const position = html.position || 'body-end'
  const body = document.body || (await waitForElement('body'))
  if (!body) return null

  if (position === 'body-start') {
    body.insertBefore(wrapper, body.firstChild)
  } else if (position === 'body-end') {
    body.appendChild(wrapper)
  } else {
    const target = html.target ? await waitForElement(html.target) : null
    if (!target) {
      // Fall back to end of body if the target never appears.
      body.appendChild(wrapper)
    } else if (position === 'before') {
      target.parentNode.insertBefore(wrapper, target)
    } else if (position === 'after') {
      target.parentNode.insertBefore(wrapper, target.nextSibling)
    } else if (position === 'inside') {
      target.appendChild(wrapper)
    } else {
      body.appendChild(wrapper)
    }
  }
  return wrapper
}

async function runJs(profile) {
  if (!profile.js || !profile.js.trim()) return
  // The content script can't run page-scoped JS or call chrome.scripting,
  // so ask the background worker to execute it in the page's MAIN world.
  await sendToBackground({
    type: MSG.RUN_JS,
    code: profile.js,
    profileId: profile.id,
    context: { settings: profile.settings || {}, storage: profile.storage || {}, name: profile.name },
  })
}

/** Apply a single profile to the current page. */
export async function applyProfile(profile) {
  // Remove any previous application first (idempotent / live re-apply).
  removeProfile(profile.id)
  const styleEl = injectCss(profile)
  const htmlRoot = await injectHtml(profile)
  applied.set(profile.id, { styleEl, htmlRoot })
  await runJs(profile)
}

/** Remove a profile's injected CSS + HTML. (JS side effects can't be reverted.) */
export function removeProfile(profileId) {
  const entry = applied.get(profileId)
  if (entry) {
    entry.styleEl?.remove()
    entry.htmlRoot?.remove()
    applied.delete(profileId)
  }
  // Also sweep any stray nodes tagged for this profile.
  document.querySelectorAll(`[data-webmod="${CSS.escape(profileId)}"]`).forEach((n) => n.remove())
}

/** Ids of profiles currently applied on this page. */
export function appliedProfileIds() {
  return [...applied.keys()]
}
