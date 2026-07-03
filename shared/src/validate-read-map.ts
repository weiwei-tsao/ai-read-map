import type { ReadMapResult } from './types.js'

export function validateReadMap(result: ReadMapResult, validTargetIds: Set<string>): ReadMapResult {
  if (result.status !== 'ok') return result

  const seen = new Set<string>()
  const validSections = result.keySections.filter((section) => {
    if (!validTargetIds.has(section.targetId)) return false
    if (seen.has(section.targetId)) return false
    seen.add(section.targetId)
    return true
  })

  if (validSections.length < 2) {
    return {
      ...result,
      status: 'low_confidence',
      keySections: validSections,
      reason: 'Not enough valid key sections after validation',
    }
  }

  return { ...result, keySections: validSections }
}
