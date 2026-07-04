import type { ReadMapResult } from 'ai-read-map-shared'

interface CacheEntry {
  value: ReadMapResult
  createdAt: number
}

// ponytail: single-process in-memory cache — entries are lost on restart and
// not shared across instances. Move to Redis if the backend scales beyond
// one process or needs to survive restarts.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, CacheEntry>()

export function buildCacheKey(domain: string, url: string, contentHash: string, promptVersion: string): string {
  return `${domain}|${url}|${contentHash}|${promptVersion}`
}

export function getCached(key: string): ReadMapResult | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

export function setCached(key: string, value: ReadMapResult): void {
  cache.set(key, { value, createdAt: Date.now() })
}
