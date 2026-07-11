// Profile persistence over chrome.storage.local, plus the global "paused" flag.

import { normalizeProfile, newId } from './profile.js'

const PROFILES_KEY = 'webmod:profiles'
const PAUSED_KEY = 'webmod:paused'

function rawGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve))
}
function rawSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve))
}

/** Get all profiles (array). Always returns an array. */
export async function getAllProfiles() {
  const data = await rawGet(PROFILES_KEY)
  const list = data[PROFILES_KEY]
  return Array.isArray(list) ? list : []
}

/** Get a single profile by id (or null). */
export async function getProfile(id) {
  const list = await getAllProfiles()
  return list.find((p) => p.id === id) || null
}

/** Persist the full profile array. */
async function writeAll(list) {
  await rawSet({ [PROFILES_KEY]: list })
}

/** Insert or update a profile. Returns the saved profile. */
export async function saveProfile(profile) {
  const list = await getAllProfiles()
  const p = { ...profile, updatedAt: new Date().toISOString() }
  const idx = list.findIndex((x) => x.id === p.id)
  if (idx >= 0) list[idx] = p
  else list.push(p)
  await writeAll(list)
  return p
}

/** Remove a profile by id. */
export async function removeProfile(id) {
  const list = await getAllProfiles()
  await writeAll(list.filter((p) => p.id !== id))
}

/** Duplicate a profile (new id, "(copy)" name). Returns the new profile. */
export async function duplicateProfile(id) {
  const src = await getProfile(id)
  if (!src) return null
  const copy = normalizeProfile({ ...src, id: newId(), name: src.name + ' (copy)' })
  return saveProfile(copy)
}

/** Replace the entire profile list (used by Restore). */
export async function replaceAllProfiles(list) {
  await writeAll(list)
}

/** Add profiles from an import, keeping existing ones. Returns the merged list. */
export async function addProfiles(newOnes) {
  const list = await getAllProfiles()
  const merged = [...list, ...newOnes]
  await writeAll(merged)
  return merged
}

/** Global pause flag — when true the content script injects nothing. */
export async function isPaused() {
  const data = await rawGet(PAUSED_KEY)
  return data[PAUSED_KEY] === true
}
export async function setPaused(value) {
  await rawSet({ [PAUSED_KEY]: !!value })
}

/** Subscribe to profile/pause changes. Calls cb() on any relevant change. */
export function onChange(cb) {
  const listener = (changes, area) => {
    if (area !== 'local') return
    if (PROFILES_KEY in changes || PAUSED_KEY in changes) cb(changes)
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

export const KEYS = { PROFILES_KEY, PAUSED_KEY }
