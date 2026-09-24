import { z } from 'zod'

const cardSchema = z.object({
  id: z.string().min(1), question: z.string().min(1), answer: z.string().min(1),
  topic: z.string().min(1), difficulty: z.enum(['easy', 'medium', 'hard'])
})

const quizQuestionSchema = z.object({
  id: z.string().min(1), question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(1), topic: z.string().min(1)
})

export const studySetSchema = z.object({
  title: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(600),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  cards: z.array(cardSchema).min(5).max(10),
  quiz: z.array(quizQuestionSchema).min(5).max(10)
}).superRefine((set, ctx) => {
  const ids = [...set.cards.map(card => card.id), ...set.quiz.map(question => question.id)]
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Study card and quiz IDs must be unique.' })
  }
})

export type StudySet = z.infer<typeof studySetSchema>
export type Answer = { questionId: string; selected: number }
export type SavedSession = {
  studySet: StudySet
  savedAt: number
  viewedCardIds: string[]
  knownCardIds: string[]
  missedCardIds: string[]
  answers: Answer[]
}
