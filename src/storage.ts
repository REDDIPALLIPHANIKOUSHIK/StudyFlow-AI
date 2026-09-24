import { z } from 'zod'
import { studySetSchema, type SavedSession } from './types'

const KEY = 'studyflow.latest.v1'
const answerSchema = z.object({ questionId: z.string(), selected: z.number().int().min(0).max(3) })
const savedSessionSchema = z.object({
  studySet: studySetSchema,
  savedAt: z.number().finite(),
  knownCardIds: z.array(z.string()),
  missedCardIds: z.array(z.string()),
  answers: z.array(answerSchema)
})

export function loadStudySession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = savedSessionSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
    localStorage.removeItem(KEY)
  } catch {
    try { localStorage.removeItem(KEY) } catch { /* Storage can be disabled by the browser. */ }
  }
  return null
}

export function saveStudySession(session: SavedSession): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

export function clearStudySession(): boolean {
  try {
    localStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}
