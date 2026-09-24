import { studySetSchema, type StudySet } from './types'

export async function generate(input: string, signal: AbortSignal): Promise<StudySet> {
  let response: Response
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
      signal
    })
  } catch {
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError')
    throw new Error('Could not reach the study service. Make sure both development servers are running, then try again.')
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('The study service returned an unexpected response. Check that the backend is running on port 3001.')
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'The study service could not generate a study set. Please try again.'
    throw new Error(message)
  }

  const parsed = studySetSchema.safeParse(payload)
  if (!parsed.success) throw new Error('The AI response did not match the required study set format. Please try again.')
  return parsed.data
}
