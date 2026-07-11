// Message-type constants and small helpers used across the extension.

export const MSG = {
  RUN_JS: 'webmod:run-js', // content -> background: run user JS in MAIN world
  RE_APPLY: 'webmod:re-apply', // background -> content: re-apply a profile (live dev)
  PROFILE_SAVED: 'webmod:profile-saved', // options -> background: a profile changed
  GET_ACTIVE_PROFILES: 'webmod:get-active', // popup -> content: which profiles are active here
}

/** Send a message to the background service worker. Resolves with the response (or null). */
export function sendToBackground(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (resp) => {
        // Swallow "no receiver" errors — they're expected on some pages.
        void chrome.runtime.lastError
        resolve(resp ?? null)
      })
    } catch {
      resolve(null)
    }
  })
}

/** Send a message to a specific tab's content script. Resolves with the response (or null). */
export function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (resp) => {
        void chrome.runtime.lastError
        resolve(resp ?? null)
      })
    } catch {
      resolve(null)
    }
  })
}
