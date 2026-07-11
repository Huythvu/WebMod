// Reactive profile store bound to chrome.storage.local via lib/storage.js.

import { ref } from 'vue'
import {
  getAllProfiles,
  saveProfile as persistProfile,
  removeProfile as persistRemove,
  duplicateProfile as persistDuplicate,
  addProfiles as persistAdd,
  isPaused,
  setPaused as persistPaused,
  onChange,
} from '../../lib/storage.js'
import { MSG, sendToBackground } from '../../lib/messaging.js'

const profiles = ref([])
const paused = ref(false)
let started = false

async function refresh() {
  profiles.value = await getAllProfiles()
  paused.value = await isPaused()
}

function start() {
  if (started) return
  started = true
  refresh()
  onChange(() => refresh())
}

/** Persist a profile and trigger live re-apply in matching tabs. */
async function saveProfile(profile) {
  const saved = await persistProfile(profile)
  await refresh()
  // Ask the background worker to push the change to open tabs (live development).
  sendToBackground({ type: MSG.PROFILE_SAVED, profile: saved })
  return saved
}

async function removeProfile(id) {
  await persistRemove(id)
  await refresh()
}

async function duplicateProfile(id) {
  const copy = await persistDuplicate(id)
  await refresh()
  return copy
}

async function importProfiles(list) {
  await persistAdd(list)
  await refresh()
}

async function togglePaused() {
  await persistPaused(!paused.value)
  await refresh()
}

export function useProfiles() {
  start()
  return {
    profiles,
    paused,
    refresh,
    saveProfile,
    removeProfile,
    duplicateProfile,
    importProfiles,
    togglePaused,
  }
}
