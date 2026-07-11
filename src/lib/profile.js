// Profile schema, defaults, validation, and (de)serialization for import/export.

export const HTML_POSITIONS = [
  { value: 'body-start', label: 'Beginning of <body>' },
  { value: 'body-end', label: 'End of <body>' },
  { value: 'before', label: 'Before target element' },
  { value: 'after', label: 'After target element' },
  { value: 'inside', label: 'Inside target element' },
]

export const MATCH_TYPES = [
  { value: 'domain', label: 'Domain (+ subdomains)' },
  { value: 'subdomain', label: 'Exact host' },
  { value: 'url', label: 'Exact URL' },
  { value: 'glob', label: 'URL pattern (* wildcard)' },
  { value: 'regex', label: 'Regular expression' },
]

/** Generate a reasonably-unique id. */
export function newId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

/** Create a fresh profile with sensible defaults. */
export function createDefaultProfile(overrides = {}) {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: 'New Profile',
    description: '',
    enabled: true,
    matches: [{ type: 'domain', value: 'example.com' }],
    html: { code: '', position: 'body-end', target: '' },
    css: '',
    js: '',
    settings: {},
    storage: {},
    version: '1.0.0',
    tags: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Normalize an arbitrary object into a valid profile, filling in missing fields.
 * Used when importing/deserializing untrusted JSON.
 */
export function normalizeProfile(input) {
  const base = createDefaultProfile()
  const p = { ...base, ...(input && typeof input === 'object' ? input : {}) }

  p.id = typeof p.id === 'string' && p.id ? p.id : newId()
  p.name = typeof p.name === 'string' ? p.name : 'Imported Profile'
  p.description = typeof p.description === 'string' ? p.description : ''
  p.enabled = p.enabled !== false
  p.matches = Array.isArray(p.matches)
    ? p.matches
        .filter((m) => m && typeof m.value === 'string')
        .map((m) => ({ type: MATCH_TYPES.some((t) => t.value === m.type) ? m.type : 'domain', value: m.value }))
    : base.matches
  if (p.matches.length === 0) p.matches = base.matches

  const html = p.html && typeof p.html === 'object' ? p.html : {}
  p.html = {
    code: typeof html.code === 'string' ? html.code : '',
    position: HTML_POSITIONS.some((h) => h.value === html.position) ? html.position : 'body-end',
    target: typeof html.target === 'string' ? html.target : '',
  }
  p.css = typeof p.css === 'string' ? p.css : ''
  p.js = typeof p.js === 'string' ? p.js : ''
  p.settings = p.settings && typeof p.settings === 'object' ? p.settings : {}
  p.storage = p.storage && typeof p.storage === 'object' ? p.storage : {}
  p.version = typeof p.version === 'string' ? p.version : '1.0.0'
  p.tags = Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === 'string') : []
  p.notes = typeof p.notes === 'string' ? p.notes : ''
  p.createdAt = typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString()
  p.updatedAt = new Date().toISOString()
  return p
}

/** Basic validation returning an array of human-readable problems (empty = valid). */
export function validateProfile(p) {
  const errors = []
  if (!p || typeof p !== 'object') return ['Profile is not an object.']
  if (!p.name || !p.name.trim()) errors.push('Name is required.')
  if (!Array.isArray(p.matches) || p.matches.length === 0) errors.push('At least one match rule is required.')
  return errors
}

/** Serialize a single profile for export. */
export function serializeProfile(p) {
  return JSON.stringify({ _type: 'webmod-profile', _version: 1, profile: p }, null, 2)
}

/** Serialize all profiles for backup. */
export function serializeBackup(profiles) {
  return JSON.stringify({ _type: 'webmod-backup', _version: 1, profiles }, null, 2)
}

/** Parse an import file; returns { profiles: [...] } or throws. */
export function parseImport(text) {
  const data = JSON.parse(text)
  if (data && data._type === 'webmod-profile' && data.profile) {
    return { profiles: [normalizeProfile(data.profile)] }
  }
  if (data && data._type === 'webmod-backup' && Array.isArray(data.profiles)) {
    return { profiles: data.profiles.map(normalizeProfile) }
  }
  // Fall back: a bare profile object or an array of profiles.
  if (Array.isArray(data)) return { profiles: data.map(normalizeProfile) }
  if (data && typeof data === 'object') return { profiles: [normalizeProfile(data)] }
  throw new Error('Unrecognized import format.')
}
