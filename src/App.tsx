import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Brain, Check, ChevronLeft,
  ChevronRight, Layers3, RotateCcw, Sparkles, Target, X
} from 'lucide-react'
import { generate } from './api'
import { clearStudySession, loadStudySession, saveStudySession } from './storage'
import type { Answer, SavedSession, StudySet } from './types'

type Screen = 'home' | 'study' | 'quiz' | 'results'
type TopicResult = { topic: string; total: number; mistakes: number; accuracy: number }
const MAX_INPUT = 12_000

export default function App() {
  const [input, setInput] = useState('')
  const [session, setSession] = useState<SavedSession | null>(() => loadStudySession())
  const [screen, setScreen] = useState<Screen>('home')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [retryMode, setRetryMode] = useState(false)
  const [retryIds, setRetryIds] = useState<string[]>([])
  const controllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const studySet = session?.studySet ?? null
  const answers = session?.answers ?? []

  useEffect(() => () => controllerRef.current?.abort(), [])

  const activeQuestions = useMemo(() => {
    if (!studySet) return []
    return retryMode ? studySet.quiz.filter(question => retryIds.includes(question.id)) : studySet.quiz
  }, [retryIds, retryMode, studySet])

  const topicResults = useMemo<TopicResult[]>(() => {
    if (!studySet) return []
    const byTopic = new Map<string, { total: number; mistakes: number }>()
    for (const question of studySet.quiz) {
      const result = byTopic.get(question.topic) ?? { total: 0, mistakes: 0 }
      result.total += 1
      const answer = answers.find(item => item.questionId === question.id)
      if (!answer || answer.selected !== question.correctAnswer) result.mistakes += 1
      byTopic.set(question.topic, result)
    }
    return [...byTopic].map(([topic, result]) => ({
      topic,
      ...result,
      accuracy: Math.round((result.total - result.mistakes) / result.total * 100)
    })).sort((a, b) => b.mistakes - a.mistakes || a.accuracy - b.accuracy)
  }, [answers, studySet])

  const scoreQuestions = retryMode && retryIds.length > 0
    ? studySet?.quiz.filter(question => retryIds.includes(question.id)) ?? []
    : studySet?.quiz ?? []
  const correctCount = scoreQuestions.filter(question =>
    answers.some(answer => answer.questionId === question.id && answer.selected === question.correctAnswer)
  ).length
  const hasWrongAnswers = !!studySet && studySet.quiz.some(question =>
    answers.some(answer => answer.questionId === question.id && answer.selected !== question.correctAnswer)
  )

  function persist(next: SavedSession) {
    setSession(next)
    if (!saveStudySession(next)) setError('Your study set is open, but browser storage is unavailable. It may not be saved after you close this page.')
  }

  async function handleGenerate() {
    const trimmedInput = input.trim()
    if (trimmedInput.length < 3 || trimmedInput.length > MAX_INPUT) return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = ++requestIdRef.current
    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    // Render's free instance can take 50+ seconds to wake after inactivity.
    }, 90_000)

    setBusy(true)
    setError('')
    try {
      const generated = await generate(trimmedInput, controller.signal)
      if (requestId !== requestIdRef.current) return
      const nextSession: SavedSession = {
        studySet: generated,
        savedAt: Date.now(),
        viewedCardIds: [generated.cards[0].id],
        knownCardIds: [],
        missedCardIds: [],
        answers: []
      }
      setRetryMode(false)
      setRetryIds([])
      setCardIndex(0)
      setFlipped(false)
      setQuestionIndex(0)
      persist(nextSession)
      setScreen('study')
    } catch (cause) {
      if (requestId !== requestIdRef.current) return
      if (timedOut) setError('Generation took too long. Please try again; your notes are still here.')
      else if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
      }
    } finally {
      window.clearTimeout(timeoutId)
      if (requestId === requestIdRef.current) {
        controllerRef.current = null
        setBusy(false)
      }
    }
  }

  function startQuiz(retry = false) {
    if (!studySet || !session) return
    setQuestionIndex(0)
    setRetryMode(retry)
    if (retry) {
      const missedIds = studySet.quiz.filter(question =>
        session.answers.some(answer => answer.questionId === question.id && answer.selected !== question.correctAnswer)
      ).map(question => question.id)
      setRetryIds(missedIds)
      persist({ ...session, answers: session.answers.filter(answer => !missedIds.includes(answer.questionId)) })
    } else {
      setRetryIds([])
      persist({ ...session, answers: [] })
    }
    setScreen('quiz')
  }

  function answerQuestion(selected: number) {
    if (!session) return
    const question = activeQuestions[questionIndex]
    if (!question || session.answers.some(answer => answer.questionId === question.id)) return
    persist({ ...session, answers: [...session.answers, { questionId: question.id, selected }] })
  }

  function advanceQuestion() {
    if (questionIndex + 1 >= activeQuestions.length) setScreen('results')
    else setQuestionIndex(index => index + 1)
  }

  function rateCard(known: boolean) {
    if (!session) return
    const id = session.studySet.cards[cardIndex].id
    const knownCardIds = session.knownCardIds.filter(cardId => cardId !== id)
    const missedCardIds = session.missedCardIds.filter(cardId => cardId !== id)
    if (known) knownCardIds.push(id)
    else missedCardIds.push(id)
    const viewedCardIds = session.viewedCardIds.includes(id) ? session.viewedCardIds : [...session.viewedCardIds, id]
    persist({ ...session, viewedCardIds, knownCardIds, missedCardIds })
    setFlipped(false)
    if (cardIndex < session.studySet.cards.length - 1) setCardIndex(index => index + 1)
  }

  function startNewSet() {
    controllerRef.current?.abort()
    requestIdRef.current += 1
    clearStudySession()
    setSession(null)
    setScreen('home')
    setError('')
    setRetryMode(false)
    setRetryIds([])
    setInput('')
    setBusy(false)
  }

  function continueSession() {
    if (!session) return
    setCardIndex(0)
    setFlipped(false)
    setScreen('study')
    setError('')
  }

  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={() => setScreen('home')} aria-label="StudyFlow AI home">
        <span className="brand-icon"><Sparkles size={18} /></span>studyflow<span className="ai">.ai</span>
      </button>
      <div className="top-note"><i /> your personal study space <span className="avatar">S</span></div>
    </header>

    <main>
      {screen === 'home' && <HomeView
        input={input} setInput={setInput} error={error} busy={busy} session={session}
        onGenerate={handleGenerate} onContinue={continueSession} onNew={startNewSet}
      />}
      {screen === 'study' && studySet && session && <StudyView
        session={session} cardIndex={cardIndex} flipped={flipped} error={error}
        onBack={() => setScreen('home')} onFlip={() => setFlipped(value => !value)}
        onCard={index => {
          setCardIndex(index)
          setFlipped(false)
          if (session && !session.viewedCardIds.includes(session.studySet.cards[index].id)) {
            persist({ ...session, viewedCardIds: [...session.viewedCardIds, session.studySet.cards[index].id] })
          }
        }} onRate={rateCard}
        onQuiz={() => startQuiz(false)} onRetry={() => startQuiz(true)} onNew={startNewSet}
      />}
      {screen === 'quiz' && studySet && session && <QuizView
        questions={activeQuestions} questionIndex={questionIndex} answers={answers} retry={retryMode}
        onChoose={answerQuestion} onNext={advanceQuestion} onBack={() => setScreen('study')}
      />}
      {screen === 'results' && studySet && <ResultsView
        studySet={studySet} topics={topicResults} correctCount={correctCount}
        scoreTotal={scoreQuestions.length} hasWrong={hasWrongAnswers} retry={retryMode}
        onRetry={() => startQuiz(true)} onStudy={() => setScreen('study')} onNew={startNewSet}
      />}
    </main>
    <footer><span>Made for curious minds.</span><span><i /> A little progress adds up.</span></footer>
  </div>
}

function HomeView({ input, setInput, error, busy, session, onGenerate, onContinue, onNew }: {
  input: string; setInput: (value: string) => void; error: string; busy: boolean
  session: SavedSession | null; onGenerate: () => void; onContinue: () => void; onNew: () => void
}) {
  const tooLong = input.length > MAX_INPUT
  return <>
    <section className="hero">
      <div className="eyebrow"><b /> A CALMER WAY TO LEARN</div>
      <h1>Make your next<br /><em>study session</em> count.</h1>
      <p>Turn your notes into a focused, interactive session.<br />Small steps, stronger understanding.</p>
    </section>
    <section className="composer">
      <div className="composer-title">
        <span className="tile"><BookOpen size={18} /></span>
        <div><label htmlFor="notes">What are we learning today?</label><small>Paste your notes or describe a topic to get started.</small></div>
        <span className="private"><i /> PRIVATE</span>
      </div>
      <textarea id="notes" value={input} onChange={event => setInput(event.target.value)}
        aria-describedby="input-count input-error" placeholder="e.g. Explain operating system processes, threads, scheduling algorithms and deadlocks for a second-year computer science student…" />
      <div className="composer-bottom">
        <span id="input-count" aria-live="polite">{input.length.toLocaleString()} / {MAX_INPUT.toLocaleString()}</span>
        <button className="primary" onClick={onGenerate} disabled={input.trim().length < 3 || tooLong || busy}>
          {busy ? <><span className="spinner" /> Building your set</> : <>{error ? 'Try again' : 'Generate study set'} <ArrowUpRight size={16} /></>}
        </button>
      </div>
      {tooLong && <div className="error" id="input-error" role="alert">Your input is too long. Please shorten it to 12,000 characters or fewer.</div>}
      {error && !tooLong && <div className="error" id="input-error" role="alert">{error}</div>}
    </section>
    <div className="examples">
      <span><Sparkles size={13} /> TRY AN EXAMPLE</span>
      <button onClick={() => setInput('Explain the water cycle, including evaporation, condensation, precipitation, and collection. Create an easy-to-understand study guide for a high school student.')}>The water cycle <ArrowUpRight size={12} /></button>
      <button onClick={() => setInput('Explain photosynthesis, chlorophyll, light-dependent reactions, the Calvin cycle, and the role of carbon dioxide and water.')}>Photosynthesis <ArrowUpRight size={12} /></button>
    </div>
    {session && <section className="resume">
      <span className="tile"><BookOpen size={18} /></span>
      <span><strong>Continue your last study session?</strong><small>{session.studySet.title} · saved {new Date(session.savedAt).toLocaleString()}</small></span>
      <div className="resume-actions"><button onClick={onContinue}>Continue <ArrowRight size={15} /></button><button onClick={onNew}>Start New</button></div>
    </section>}
    <div className="steps"><span><i>01</i> Add your notes</span><b /><span><i>02</i> Learn at your pace</span><b /><span><i>03</i> See what sticks</span></div>
  </>
}

function StudyView({ session, cardIndex, flipped, error, onBack, onFlip, onCard, onRate, onQuiz, onRetry, onNew }: {
  session: SavedSession; cardIndex: number; flipped: boolean; error: string
  onBack: () => void; onFlip: () => void; onCard: (index: number) => void
  onRate: (known: boolean) => void; onQuiz: () => void; onRetry: () => void; onNew: () => void
}) {
  const set = session.studySet
  const card = set.cards[cardIndex]
  const missedQuestions = set.quiz.filter(question => session.answers.some(answer => answer.questionId === question.id && answer.selected !== question.correctAnswer)).length
  return <section className="workspace">
    <button className="back" onClick={onBack}><ArrowLeft size={15} /> All sessions</button>
    <div className="set-heading"><div><div className="eyebrow"><b /> YOUR STUDY SET</div><h2>{set.title}</h2><p>{set.summary}</p></div><span className="badge">{set.difficulty}</span></div>
    <div className="metrics">
      <div><Layers3 /><strong>{set.cards.length}</strong><small>FLASHCARDS</small></div>
      <div><Brain /><strong>{set.quiz.length}</strong><small>QUIZ QUESTIONS</small></div>
      <div><Target /><strong>{new Set(set.quiz.map(question => question.topic)).size}</strong><small>TOPICS</small></div>
    </div>
    {error && <div className="error" role="status">{error}</div>}
    <div className="section-head"><div><small>01 — GET FAMILIAR</small><h3>Flashcards</h3></div><span>{String(cardIndex + 1).padStart(2, '0')} <i>/</i> {String(set.cards.length).padStart(2, '0')}</span></div>
    <div className={`flashcard ${flipped ? 'flipped' : ''}`}>
      <div className="card-tags"><span>{card.topic}</span><span>{card.difficulty}</span></div>
      <small>{flipped ? 'ANSWER' : 'QUESTION'}</small>
      <strong>{flipped ? card.answer : card.question}</strong>
      {!flipped && <button className="flip-hint" onClick={onFlip}><RotateCcw size={13} /> Reveal answer</button>}
      {flipped && <div className="rating-actions"><button onClick={() => onRate(false)}><X size={15} /> Didn’t Know</button><button onClick={() => onRate(true)}><Check size={15} /> Got It</button></div>}
    </div>
    <div className="card-controls">
      <button onClick={() => onCard((cardIndex + set.cards.length - 1) % set.cards.length)} aria-label="Previous card"><ChevronLeft /></button>
      <div>{set.cards.map((item, index) => <button aria-label={`Card ${index + 1}`} className={index === cardIndex ? 'on' : ''} key={item.id} onClick={() => onCard(index)} />)}</div>
      <button onClick={() => onCard((cardIndex + 1) % set.cards.length)} aria-label="Next card"><ChevronRight /></button>
    </div>
    <p className="card-progress">Viewed {session.viewedCardIds.length} · Mastered {session.knownCardIds.length} · Revisit {session.missedCardIds.length}</p>
    <div className="quiz-banner"><span className="tile"><Brain /></span><div><strong>Ready to check your understanding?</strong><small>Take a quick quiz and find your strong spots.</small></div><button onClick={onQuiz}>Start quiz <ArrowRight size={15} /></button></div>
    {missedQuestions > 0 && <button className="secondary retry-study" onClick={onRetry}><RotateCcw size={15} /> Retry {missedQuestions} missed quiz question{missedQuestions === 1 ? '' : 's'}</button>}
    <button className="text-action" onClick={onNew}>Start a new study set <ArrowUpRight size={15} /></button>
  </section>
}

function QuizView({ questions, questionIndex, answers, retry, onChoose, onNext, onBack }: {
  questions: StudySet['quiz']; questionIndex: number; answers: Answer[]; retry: boolean
  onChoose: (selected: number) => void; onNext: () => void; onBack: () => void
}) {
  const question = questions[questionIndex]
  if (!question) return <section className="workspace"><button className="back" onClick={onBack}><ArrowLeft size={15} /> Study set</button><h2>Nothing to retry</h2><p>You got every question right. Beautiful work.</p></section>
  const answer = answers.find(item => item.questionId === question.id)
  const progress = Math.round((questionIndex + (answer ? 1 : 0)) / questions.length * 100)
  return <section className="workspace quiz">
    <button className="back" onClick={onBack}><ArrowLeft size={15} /> Study set</button>
    <div className="quiz-progress-label"><small>{retry ? 'SMART RETRY' : 'QUICK CHECK'}</small><span>Question {questionIndex + 1} of {questions.length}</span></div>
    <div className="progress"><i style={{ width: `${progress}%` }} /></div>
    <span className="topic">{question.topic}</span><h2>{question.question}</h2>
    <div className="options">{question.options.map((option, index) => {
      const correct = !!answer && index === question.correctAnswer
      const incorrect = !!answer && index === answer.selected && !correct
      return <button disabled={!!answer} className={`${correct ? 'correct' : ''} ${incorrect ? 'wrong' : ''}`} key={index} onClick={() => onChoose(index)}>
        <i>{String.fromCharCode(65 + index)}</i><span>{option}</span>
        {correct && <Check size={17} />}{incorrect && <X size={17} />}
      </button>
    })}</div>
    {answer && <div className="explanation" role="status"><strong>{answer.selected === question.correctAnswer ? 'Correct.' : 'Incorrect.'}</strong><span>{question.explanation}</span></div>}
    <div className="quiz-footer"><span>No timer. Take your time.</span>{answer && <button className="primary" onClick={onNext}>{questionIndex === questions.length - 1 ? 'See results' : 'Next question'} <ArrowRight size={15} /></button>}</div>
  </section>
}

function ResultsView({ studySet, topics, correctCount, scoreTotal, hasWrong, retry, onRetry, onStudy, onNew }: {
  studySet: StudySet; topics: TopicResult[]; correctCount: number; scoreTotal: number
  hasWrong: boolean; retry: boolean; onRetry: () => void; onStudy: () => void; onNew: () => void
}) {
  const percentage = scoreTotal ? Math.round(correctCount / scoreTotal * 100) : 0
  return <section className="workspace">
    <button className="back" onClick={onStudy}><ArrowLeft size={15} /> Study set</button>
    <div className="results-hero">
      <div className="score" style={{ '--deg': `${percentage * 3.6}deg` } as CSSProperties}><div><strong>{percentage}<small>%</small></strong><small>YOUR SCORE</small></div></div>
      <div><div className="eyebrow"><b /> {retry ? 'RETRY COMPLETE' : 'SESSION COMPLETE'}</div><h2>{percentage >= 80 ? 'You’re finding your flow.' : 'Every answer is a step forward.'}</h2><p>You got <strong>{correctCount} of {scoreTotal}</strong> questions right on {studySet.title}.</p></div>
    </div>
    <div className="result-counts"><div><Check size={16} /><strong>{correctCount}</strong><span>Correct</span></div><div><X size={16} /><strong>{scoreTotal - correctCount}</strong><span>Incorrect</span></div></div>
    <div className="section-head"><div><small>BASED ON YOUR ANSWERS</small><h3>Topics to revisit</h3></div></div>
    <div className="topic-list">{topics.map(topic => <div key={topic.topic}>
      <span className={topic.mistakes > 0 ? 'needs' : ''}>{topic.mistakes ? <Target size={15} /> : <Check size={15} />}</span>
      <strong>{topic.topic}<small>{topic.mistakes} mistake{topic.mistakes === 1 ? '' : 's'} · {topic.accuracy}% correct</small></strong>
      <i><b style={{ width: `${topic.accuracy}%` }} /></i><em>{topic.accuracy}%</em>
    </div>)}</div>
    <div className="result-actions">
      {hasWrong && <button className="primary" onClick={onRetry}><RotateCcw size={15} /> Retry wrong answers <ArrowRight size={15} /></button>}
      <button className="secondary" onClick={onStudy}>Review flashcards <BookOpen size={15} /></button>
      <button className="secondary" onClick={onNew}>New study set <ArrowUpRight size={15} /></button>
    </div>
  </section>
}

