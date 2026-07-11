// URL matching — the single source of truth used by the content script and the popup.

/** Convert a glob (with * wildcards) into an anchored RegExp over the full URL. */
function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$')
}

/** Test a single match rule against a parsed URL. Never throws. */
export function ruleMatches(rule, url) {
  if (!rule || typeof rule.value !== 'string' || !rule.value) return false
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = parsed.hostname
  const value = rule.value.trim()

  switch (rule.type) {
    case 'domain': {
      // matches the domain itself and any subdomain
      const d = value.replace(/^\*\.?/, '').toLowerCase()
      const h = host.toLowerCase()
      return h === d || h.endsWith('.' + d)
    }
    case 'subdomain': {
      // exact host match
      return host.toLowerCase() === value.toLowerCase()
    }
    case 'url': {
      // exact URL, ignoring a trailing slash difference
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
