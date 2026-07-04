import { describe, it, expect } from 'vitest'
import { buildCacheKey, getCached, setCached } from './cache.js'
import type { ReadMapResult } from 'ai-read-map-shared'

const readMap: ReadMapResult = {
  status: 'ok',
  overview: 'Overview',
  keySections: [],
  pageQuality: 'high',
  missingContext: [],
  reason: '',
}

describe('cache', () => {
  it('returns undefined for a miss and the value for a hit', () => {
    const key = buildCacheKey('example.com', 'https://example.com/a', 'hash1', 'v1')
    expect(getCached(key)).toBeUndefined()
    setCached(key, readMap)
    expect(getCached(key)).toEqual(readMap)
  })

  it('keys are distinct per content hash', () => {
    const keyA = buildCacheKey('example.com', 'https://example.com/a', 'hashA', 'v1')
    const keyB = buildCacheKey('example.com', 'https://example.com/a', 'hashB', 'v1')
    setCached(keyA, readMap)
    expect(getCached(keyB)).toBeUndefined()
  })
})
