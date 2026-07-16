import { describe, it, expect } from 'vitest'
import { validateReadMap } from './validate-read-map.js'
import type { ReadMapResult } from './types.js'

function makeResult(overrides: Partial<ReadMapResult> = {}): ReadMapResult {
  return {
    status: 'ok',
    overview: 'Overview',
    keySections: [
      { label: 'A', preview: 'why', targetId: 'p1' },
      { label: 'B', preview: 'why', targetId: 'p2' },
    ],
    pageQuality: 'high',
    missingContext: [],
    reason: '',
    ...overrides,
  }
}

describe('validateReadMap', () => {
  it('passes through when all target IDs are valid', () => {
    const result = validateReadMap(makeResult(), new Set(['p1', 'p2']))
    expect(result.status).toBe('ok')
    expect(result.keySections).toHaveLength(2)
  })

  it('drops invalid target IDs', () => {
    const result = validateReadMap(
      makeResult({
        keySections: [
          { label: 'A', preview: 'why', targetId: 'p1' },
          { label: 'Fake', preview: 'why', targetId: 'does-not-exist' },
          { label: 'C', preview: 'why', targetId: 'p2' },
        ],
      }),
      new Set(['p1', 'p2']),
    )
    expect(result.keySections.map((s) => s.targetId)).toEqual(['p1', 'p2'])
  })

  it('drops duplicate target IDs, keeping the first', () => {
    const result = validateReadMap(
      makeResult({
        keySections: [
          { label: 'A', preview: 'why', targetId: 'p1' },
          { label: 'A again', preview: 'why', targetId: 'p1' },
        ],
      }),
      new Set(['p1']),
    )
    expect(result.keySections).toHaveLength(1)
  })

  it('downgrades to low_confidence when fewer than 2 valid sections remain', () => {
    const result = validateReadMap(
      makeResult({ keySections: [{ label: 'A', preview: 'why', targetId: 'p1' }] }),
      new Set(['p1']),
    )
    expect(result.status).toBe('low_confidence')
  })

  it('leaves non-ok statuses untouched', () => {
    const result = validateReadMap(makeResult({ status: 'not_suitable', keySections: [] }), new Set())
    expect(result.status).toBe('not_suitable')
  })
})
