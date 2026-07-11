// Profile persistence over chrome.storage.local, plus the global "paused" flag.

import { normalizeProfile, newId } from './profile.js'

const PROFILES_KEY = 'webmod:profiles'
const PAUSED_KEY = 'webmod:paused'
const DATA_PREFIX = 'webmod:data:' // live per-profile key/value store
const DATA_INIT_PREFIX = 'webmod:data-init:' // "seed applied" flag per profile
const OPEN_EDITOR_KEY = 'webmod:open-editor' // transient deep-link from popup -> dashboard

function rawGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve))
}
function rawSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve))
}
function rawRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve))
}

// Strip framework reactivity (Vue proxies) and any non-clonable wrappers so the
// value is a plain, structured-clonable object before it reaches chrome.storage
// or a cross-context message. Profiles hold only JSON-serializable data.
function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
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

/** Persist the full profile array (always as plain, clonable objects). */
async function writeAll(list) {
  await rawSet({ [PROFILES_KEY]: toPlain(list) })
}

/** Insert or update a profile. Returns the saved (plain) profile. */
export async function saveProfile(profile) {
  const list = await getAllProfiles()
  // De-proxy up front so the stored list and the returned value are both plain.
  const p = { ...toPlain(profile), updatedAt: new Date().toISOString() }
  const idx = list.findIndex((x) => x.id === p.id)
  if (idx >= 0) list[idx] = p
  else list.push(p)
  await writeAll(list)
  return p
}

/** Remove a profile by id (and its live storage). */
export async function removeProfile(id) {
  const list = await getAllProfiles()
  await writeAll(list.filter((p) => p.id !== id))
  await rawRemove([DATA_PREFIX + id, DATA_INIT_PREFIX + id])
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

// --- Live per-profile key/value storage (isolated per profile) ---------------

/** Read a profile's live storage object (always an object). */
export async function getProfileData(id) {
  const key = DATA_PREFIX + id
  const data = await rawGet(key)
  const obj = data[key]
  return obj && typeof obj === 'object' ? obj : {}
}

/** Overwrite a profile's live storage object. */
export async function setProfileData(id, obj) {
  await rawSet({ [DATA_PREFIX + id]: toPlain(obj || {}) })
}

/** Seed a profile's live storage from its Storage-tab defaults, once. */
export async function ensureProfileDataSeed(id, seed) {
  const initKey = DATA_INIT_PREFIX + id
  const flag = await rawGet(initKey)
  if (flag[initKey]) return
  await rawSet({ [DATA_PREFIX + id]: toPlain(seed || {}), [initKey]: true })
}

/** Reset a profile's live storage back to the given seed (defaults). */
export async function resetProfileData(id, seed) {
  await rawSet({ [DATA_PREFIX + id]: toPlain(seed || {}), [DATA_INIT_PREFIX + id]: true })
}

// --- Deep-link: popup asks the dashboard to open a specific profile ----------

export async function requestOpenEditor(id) {
  await rawSet({ [OPEN_EDITOR_KEY]: id })
}

/** Read-and-clear the pending "open this profile in the editor" request. */
export async function consumeOpenEditor() {
  const d = await rawGet(OPEN_EDITOR_KEY)
  const id = d[OPEN_EDITOR_KEY]
  if (id) await rawRemove(OPEN_EDITOR_KEY)
  return id || null
}

export const KEYS = { PROFILES_KEY, PAUSED_KEY, DATA_PREFIX, DATA_INIT_PREFIX }
