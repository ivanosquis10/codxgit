import { DATE_RANGE_PRESETS, DEFAULT_RANGE_PRESET, type DateRangePreset } from './types'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * One `owner/name` GitHub repository, as it may appear in the URL
 * (`?repos=acme/api,acme/web`). A comma cannot appear in either part.
 */
const REPO_PART_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * Project ids in the URL carry a `p` prefix (`?projects=p10,p11`).
 *
 * TanStack Router's default search parser coerces bare numeric values to
 * numbers, which makes the canonical URL disagree with the requested one and
 * triggers a redirect. A prefixed value stays a plain string, so the URL the
 * user asked for is the URL that renders.
 */
const PROJECT_PREFIX = 'p'

/** Accept a `YYYY-MM-DD` range anchor from the URL; ignore anything else. */
export function parseAnchorParam(value: unknown): string | undefined {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return undefined
  return value
}

/** Accept a known range preset from the URL; an unknown value falls back to the default. */
export function parseRangePreset(value: unknown): DateRangePreset | undefined {
  if (typeof value !== 'string') return undefined
  return (DATE_RANGE_PRESETS as readonly string[]).includes(value)
    ? (value as DateRangePreset)
    : undefined
}

/**
 * Serialize a preset for the URL. The default preset is omitted so a bare
 * route keeps meaning "the default range".
 *
 * `anchor` is the `YYYY-MM-DD` date the link also carries, when it has one.
 * Beside an anchor the default preset must stay explicit: `resolveRange`
 * reads an anchor without a preset as the historical Monday–Friday week, so
 * omitting the default there would silently render a different range than the
 * button names.
 */
export function serializeRangePreset(
  preset: DateRangePreset | undefined,
  anchor?: string,
): DateRangePreset | undefined {
  if (!preset) return undefined
  if (preset === DEFAULT_RANGE_PRESET && !anchor) return undefined
  return preset
}

/** Accept `p12,p11` (or repeated params, or bare numbers) as project numbers. */
export function parseProjectList(value: unknown): number[] {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? [value] : []
  if (Array.isArray(value)) return value.flatMap((entry) => parseProjectList(entry))
  if (typeof value !== 'string') return []

  const numbers = value
    .split(',')
    .map((part) => part.trim().replace(new RegExp(`^${PROJECT_PREFIX}`, 'i'), ''))
    .map((part) => Number(part))
    .filter((number) => Number.isInteger(number) && number > 0)

  return [...new Set(numbers)].sort((a, b) => a - b)
}

/** Serialize selected project numbers for the URL; `undefined` when empty. */
export function serializeProjectList(numbers: number[]): string | undefined {
  const unique = [...new Set(numbers.filter((number) => Number.isInteger(number) && number > 0))].sort(
    (a, b) => a - b,
  )
  return unique.length > 0 ? unique.map((number) => `${PROJECT_PREFIX}${number}`).join(',') : undefined
}

/**
 * Accept one `owner/name` repository. Rejects anything that is not exactly two
 * safe path segments, so a URL can never carry a path, a traversal or an
 * absolute reference into the filter.
 */
export function isValidRepoParam(repo: string): boolean {
  if (typeof repo !== 'string' || repo.length === 0) return false
  if (repo.includes('..') || repo.includes('\\') || repo.includes(',')) return false
  if (/[\u0000-\u001f\u007f]/.test(repo)) return false
  const parts = repo.split('/')
  if (parts.length !== 2) return false
  return parts.every((part) => REPO_PART_PATTERN.test(part))
}

/** Owner then name, case-insensitive, so the canonical order is stable. */
function compareRepos(a: string, b: string): number {
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

/** Accept `owner/name,owner2/name2` (or repeated params) as repository filters. */
export function parseRepoList(value: unknown): string[] {
  const entries: unknown[] = Array.isArray(value) ? value.flat(Infinity) : [value]
  const seen = new Set<string>()
  const repos: string[] = []

  for (const entry of entries) {
    if (typeof entry !== 'string') continue
    for (const part of entry.split(',')) {
      const repo = part.trim()
      if (!isValidRepoParam(repo)) continue
      const key = repo.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      repos.push(repo)
    }
  }

  return repos.sort(compareRepos)
}

/** Serialize selected repositories for the URL; `undefined` when empty. */
export function serializeRepoList(repos: string[]): string | undefined {
  const unique = parseRepoList(repos)
  return unique.length > 0 ? unique.join(',') : undefined
}
