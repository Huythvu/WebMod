// Content script (ISOLATED world). Runs on every page at document_idle.
// Reads profiles, applies the enabled ones that match this URL, and listens
// for live re-apply messages from the editor.

import { getAllProfiles, isPaused } from '../lib/storage.js'
import { profileMatchesUrl, activeProfilesForUrl } from '../lib/matcher.js'
import { applyProfile, removeProfile, appliedProfileIds } from './apply.js'
import { MSG } from '../lib/messaging.js'

async function applyAll() {
  if (await isPaused()) return
  const profiles = await getAllProfiles()
  const active = activeProfilesForUrl(profiles, location.href)
  for (const p of active) {
    await applyProfile(p)
  }
}

// Live development: respond to re-apply requests targeting this page.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return

  if (msg.type === MSG.RE_APPLY && msg.profile) {
    ;(async () => {
      if (await isPaused()) {
        removeProfile(msg.profile.id)
        sendResponse({ ok: true, applied: false })
        return
      }
      if (msg.profile.enabled && profileMatchesUrl(msg.profile, location.href)) {
        await applyProfile(msg.profile)
        sendResponse({ ok: true, applied: true })
      } else {
        removeProfile(msg.profile.id)
        sendResponse({ ok: true, applied: false })
      }
    })()
    return true // async response
  }

  if (msg.type === MSG.GET_ACTIVE_PROFILES) {
    sendResponse({ ids: appliedProfileIds(), url: location.href })
    return false
  }
})

applyAll()
