// Storage bridge (ISOLATED world). The user's JS runs in the page's MAIN world,
// which has no access to chrome.storage. It talks to us over window.postMessage
// (both worlds share the same DOM), and we service the request against the
// profile's isolated live storage.
//
// Protocol:
//   page  -> content: { source:'webmod-page', id, profileId, op, key, value }
//   content -> page:   { source:'webmod-content', id, ok, result | error }

import { getProfileData, setProfileData } from '../lib/storage.js'

async function handle({ profileId, op, key, value }) {
  const store = await getProfileData(profileId)
  switch (op) {
    case 'get':
      return store[key]
    case 'getAll':
      return store
    case 'keys':
      return Object.keys(store)
    case 'set':
      store[key] = value
      await setProfileData(profileId, store)
      return true
    case 'remove':
      delete store[key]
      await setProfileData(profileId, store)
      return true
    case 'clear':
      await setProfileData(profileId, {})
      return true
    default:
      throw new Error('Unknown storage op: ' + op)
  }
}

export function initStorageBridge() {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    const d = event.data
    if (!d || d.source !== 'webmod-page' || d.id == null || !d.profileId) return

    handle(d)
      .then((result) => window.postMessage({ source: 'webmod-content', id: d.id, ok: true, result }, '*'))
      .catch((err) =>
        window.postMessage({ source: 'webmod-content', id: d.id, ok: false, error: String(err && err.message || err) }, '*')
      )
  })
}
