// Background service worker (MV3). Two jobs:
//  1. Run user JS in a page's MAIN world on request from a content script.
//  2. Broadcast live re-apply messages to matching tabs when a profile is saved.

import { MSG, sendToTab } from '../lib/messaging.js'
import { profileMatchesUrl } from '../lib/matcher.js'
import { runUserCode } from './user-runtime.js'

async function runJsInTab(tabId, code, profileId, context) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: runUserCode,
      args: [code, context || {}, profileId],
    })
    return { ok: true }
  } catch (err) {
    console.error('[WebMod] executeScript failed:', err)
    return { ok: false, error: String(err) }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return

  // Content script asks us to run user JS in its tab's MAIN world.
  if (msg.type === MSG.RUN_JS && sender.tab?.id != null) {
    runJsInTab(sender.tab.id, msg.code, msg.profileId, msg.context).then(sendResponse)
    return true
  }

  // Editor saved a profile — push it to every tab it matches (live development).
  if (msg.type === MSG.PROFILE_SAVED && msg.profile) {
    broadcastReApply(msg.profile).then((count) => sendResponse({ ok: true, tabs: count }))
    return true
  }
})

async function broadcastReApply(profile) {
  const tabs = await chrome.tabs.query({})
  let count = 0
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null || !tab.url) return
      // Send to tabs that currently match OR previously might have — the content
      // script decides whether to apply or remove based on the profile state.
      if (profileMatchesUrl(profile, tab.url) || profile.enabled === false) {
        const resp = await sendToTab(tab.id, { type: MSG.RE_APPLY, profile })
        if (resp) count++
      }
    })
  )
  return count
}
