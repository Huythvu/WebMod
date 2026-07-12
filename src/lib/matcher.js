// URL matching — the single source of truth used by the content script and the popup.

/** Convert a glob (with * wildcards) into an anchored RegExp over the full URL. */
function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$')
}

/**
 * Pull just the hostname out of whatever the user typed into a domain/host rule.
 * Forgiving on purpose: accepts a bare domain, or a full pasted URL, and strips
 * the scheme, userinfo, port, path, query, hash, and a trailing slash.
 *   "https://www.youtube.com/watch?v=x" -> "www.youtube.com"
 *   "youtube.com/"                       -> "youtube.com"
 *   "*.example.com"                      -> "example.com"
 */
function extractHost(value) {
  let v = String(value || '').trim().toLowerCase()
  if (!v) return ''
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // scheme
  v = v.replace(/[/?#].*$/, '') // path / query / hash
  v = v.replace(/^[^@]*@/, '') // userinfo
  v = v.replace(/:\d+$/, '') // port
  v = v.replace(/^\*\./, '') // leading wildcard label
  return v
}

const stripWww = (h) => h.replace(/^www\./, '')

/** Test a single match rule against a parsed URL. Never throws. */
export function ruleMatches(rule, url) {
  if (!rule || typeof rule.value !== 'string' || !rule.value) return false
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = parsed.hostname.toLowerCase()
  const value = rule.value.trim()

  switch (rule.type) {
    case 'domain': {
      // Matches the domain and any subdomain; tolerant of a pasted URL and of a
      // leading "www." on either side.
      const base = stripWww(extractHost(value))
      if (!base) return false
      const h = stripWww(host)
      return h === base || h.endsWith('.' + base)
    }
    case 'subdomain': {
      // Exact host (still tolerant of a pasted URL in the value).
      const target = extractHost(value)
      return !!target && host === target
    }
    case 'url': {
      // Exact URL, ignoring only a trailing-slash difference. Query/hash are
      // significant — use a domain or glob rule to match regardless of them.
      const strip = (u) => u.replace(/\/$/, '')
      return strip(url) === strip(value)
    }
    case 'glob': {
      try {
        return globToRegExp(value).test(url)
      } catch {
        return false
      }
    }
    case 'regex': {
      try {
        return new RegExp(value).test(url)
      } catch {
        return false
      }
    }
    default:
      return false
  }
}

/** A profile matches a URL if ANY of its rules match. */
export function profileMatchesUrl(profile, url) {
  if (!profile || !Array.isArray(profile.matches)) return false
  return profile.matches.some((rule) => ruleMatches(rule, url))
}

/** Filter a list of profiles to those that are enabled and match the URL. */
export function activeProfilesForUrl(profiles, url) {
  return profiles.filter((p) => p.enabled && profileMatchesUrl(p, url))
}
