import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useRun, useStartRun, useSubmitAnswer, useUseHeal, useUseHint } from '../api/hooks'
import { isResults, type Card, type RunEvent, type Run } from '../api/types'
import { HeartBonus, HeartEmpty, HeartFull, PaperCard, StickyTag, Tape } from '../components/ui'

export function RunPage() {
  const { runId } = useParams<{ runId: string }>()
  const id = Number(runId)
  const run = useRun(id)

  if (run.isLoading) return <div className="text-[#2d2d2d]/60 italic">loading run…</div>
  if (run.error || !run.data) return <div className="paper-card postit-pink p-6">Run not found.</div>

  if (isResults(run.data)) {
    return <ResultsView run={run.data.run} attempts={run.data.attempts} />
  }
  return (
    <ActiveRunView
      runId={id}
      run={run.data.run}
      card={run.data.card}
      lastEvent={run.data.last_event}
      lastCard={run.data.last_card}
      hint={run.data.hint}
    />
  )
}

// ---------- Active card view --------------------------------------------
function ActiveRunView({
  runId,
  run,
  card,
  lastEvent,
  lastCard,
  hint,
}: {
  runId: number
  run: Run
  card: Card | null
  lastEvent: RunEvent | null
  lastCard: Card | null
  hint: string | null
}) {
  const submit = useSubmitAnswer(runId)
  const useHeal = useUseHeal(runId)
  const useHint = useUseHint(runId)
  const [answer, setAnswer] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    setAnswer('')
  }, [card?.id])

  if (!card) {
    return <div className="paper-card postit-pink p-6">No card to answer — refresh?</div>
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (submit.isPending) return
    submit.mutate({ cardId: card.id, answer })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <>
      {/* HUD */}
      <section className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="heading text-lg uppercase tracking-wider text-[#2d2d2d]/60">HP</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: run.starting_hp }).map((_, i) =>
              i < run.hp ? <HeartFull key={i} /> : <HeartEmpty key={i} />,
            )}
            {Array.from({ length: Math.max(0, run.hp - run.starting_hp) }).map((_, i) => (
              <HeartBonus key={`b${i}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="heading text-3xl md:text-4xl text-[#ff4d4d] leading-none">{run.score}</div>
            <div className="text-xs uppercase tracking-widest text-[#2d2d2d]/55">turn {run.turn + 1}</div>
          </div>
          {run.streak >= 2 && (
            <span className="heading text-xl text-[#2d5da1] wavy" style={{ transform: 'rotate(-3deg)' }}>
              {run.streak}× streak
            </span>
          )}
        </div>
      </section>

      {/* Buffs */}
      {run.buffs.length > 0 && (
        <section className="mb-6 flex flex-wrap gap-3">
          {run.buffs.map((b, i) => {
            if (b === 'heal') {
              return (
                <button
                  key={`${b}-${i}`}
                  onClick={() => useHeal.mutate()}
                  disabled={useHeal.isPending}
                  className="btn btn-ghost px-3 py-2 r-small ink-2 hover:no-underline"
                  style={{ background: '#ffd4d4', boxShadow: '3px 3px 0 0 #2d2d2d', transform: 'rotate(-2deg)' }}
                >
                  + heal (+2 HP)
                </button>
              )
            }
            if (b === 'hint') {
              return (
                <button
                  key={`${b}-${i}`}
                  onClick={() => useHint.mutate(card.id)}
                  disabled={useHint.isPending}
                  className="btn btn-ghost px-3 py-2 r-small ink-2 hover:no-underline"
                  style={{ background: '#fff9c4', boxShadow: '3px 3px 0 0 #2d2d2d', transform: 'rotate(2deg)' }}
                >
                  ? hint (this card)
                </button>
              )
            }
            if (b === 'shield') {
              return (
                <span
                  key={`${b}-${i}`}
                  className="px-3 py-2 r-small ink-2 inline-block"
                  style={{ background: '#cde6ff', boxShadow: '3px 3px 0 0 #2d2d2d', transform: 'rotate(-1.5deg)' }}
                >
                  ▽ shield ready
                </span>
              )
            }
            return (
              <span
                key={`${b}-${i}`}
                className="px-3 py-2 r-small ink-2 inline-block"
                style={{ background: '#e8d8ff', boxShadow: '3px 3px 0 0 #2d2d2d', transform: 'rotate(1.5deg)' }}
              >
                ◎ focus (next answer)
              </span>
            )
          })}
        </section>
      )}

      {/* Last-turn feedback ribbon */}
      {lastEvent && (
        lastEvent.correct ? (
          <PaperCard variant="postit-blue" rotation={-1} className="p-4 mb-6 pop">
            <div className="flex items-center justify-between gap-3">
              <div className="heading text-2xl text-[#2d5da1]">+{lastEvent.score_delta} pts</div>
              {lastEvent.buff_awarded && (
                <span className="heading text-base text-[#ff4d4d]">▲ buff: {lastEvent.buff_awarded}</span>
              )}
            </div>
            <div className="text-base text-[#2d2d2d]/80 mt-1 italic">{lastEvent.feedback}</div>
          </PaperCard>
        ) : (
          <PaperCard variant="postit-pink" rotation={1.2} className="p-4 mb-6 shake">
            <div className="heading text-2xl text-[#ff4d4d]">
              {lastEvent.shield_used ? 'shield absorbed!' : `${lastEvent.hp_delta} HP`}
            </div>
            <div className="text-base text-[#2d2d2d]/85 mt-1 italic">{lastEvent.feedback}</div>
            {lastCard && (
              <div className="text-sm text-[#2d2d2d]/60 mt-2">
                <span className="uppercase tracking-wider text-xs">answer:</span> {lastCard.answer}
              </div>
            )}
          </PaperCard>
        )
      )}

      {/* Current card */}
      <PaperCard alt rotation={-0.4} className="p-7 md:p-9">
        <Tape />
        <div className="absolute -top-3 -right-3">
          <StickyTag rotation={5}>{card.concept || '—'}</StickyTag>
        </div>
        <div className="text-xs uppercase tracking-widest text-[#2d2d2d]/55 mb-3">
          diff {card.base_difficulty.toFixed(1)}
        </div>
        <div className="heading text-2xl md:text-3xl mb-6 leading-snug pr-2">{card.question}</div>

        {hint && (
          <div className="text-base text-[#2d5da1] italic mb-4 pop" style={{ transform: 'rotate(-0.5deg)' }}>
            <span className="heading text-[#ff4d4d]">hint:</span> {hint}
          </div>
        )}

        <form ref={formRef} onSubmit={onSubmit}>
          <textarea
            name="answer"
            rows={3}
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="scribble your answer (or 'skip')"
            className="input"
          />
          <div className="flex items-center justify-between flex-wrap gap-3 mt-4">
            <span className={`text-sm text-[#2d2d2d]/60 italic ${submit.isPending ? '' : 'invisible'}`}>
              grading…
            </span>
            <button type="submit" disabled={submit.isPending} className="btn">
              Submit (⏎)
            </button>
          </div>
          {submit.error instanceof ApiError && (
            <div className="paper-card postit-pink p-3 text-base mt-4">{submit.error.message}</div>
          )}
        </form>
      </PaperCard>
    </>
  )
}

// ---------- Results view ------------------------------------------------
type AttemptItem = {
  id: number
  user_answer: string
  feedback: string
  correct: boolean
  grade: number
}

function ResultsView({ run, attempts }: { run: Run; attempts: AttemptItem[] }) {
  return (
    <>
      <section className="text-center mb-12 relative">
        {run.status === 'won' ? (
          <PaperCard variant="postit-blue" rotation={-3} className="inline-block px-10 py-6">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 z-10"
                  style={{ background: 'rgba(45,45,45,.15)', border: '1px solid rgba(45,45,45,.2)', borderRadius: 3, transform: 'translateX(-50%) rotate(-3deg)' }} />
            <h1 className="heading text-5xl md:text-7xl text-[#2d5da1] tracking-tight">DECK CLEARED!</h1>
          </PaperCard>
        ) : (
          <PaperCard variant="postit-pink" rotation={2} className="inline-block px-10 py-6">
            <Tape />
            <h1 className="heading text-5xl md:text-7xl text-[#ff4d4d] strike-soft tracking-tight">YOU DIED</h1>
          </PaperCard>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-lg">
          <span><span className="heading text-3xl text-[#ff4d4d]">{run.score}</span> pts</span>
          <span className="text-[#2d2d2d]/40">·</span>
          <span><span className="heading text-3xl">{run.turn}</span> turns</span>
          <span className="text-[#2d2d2d]/40">·</span>
          <span><span className="heading text-3xl">{run.hp}</span> HP left</span>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="heading text-2xl md:text-3xl">Attempts</h2>
          <StickyTag rotation={-3}>{attempts.length} entries</StickyTag>
        </div>

        <ul className="space-y-3">
          {attempts.map((a, i) => {
            const tilt = i % 2 === 0 ? -0.5 : 0.5
            return (
              <li key={a.id} className="paper-card p-4 relative" style={{ transform: `rotate(${tilt}deg)` }}>
                <div className="flex items-start gap-3">
                  <span
                    className={`text-2xl leading-none mt-1 select-none ${
                      a.correct ? 'text-[#2d5da1]' : 'text-[#ff4d4d]'
                    }`}
                  >
                    {a.correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="heading text-base md:text-lg break-words">{a.user_answer || '(empty)'}</div>
                    <div className="text-sm text-[#2d2d2d]/65 italic mt-1 break-words">{a.feedback}</div>
                  </div>
                  <span
                    className={`heading text-lg whitespace-nowrap ${
                      a.correct ? 'text-[#2d5da1]' : 'text-[#2d2d2d]/40'
                    }`}
                  >
                    {Math.round(a.grade * 100)}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="flex items-center gap-5 flex-wrap justify-center">
        <Link to={`/decks/${run.deck_id}`} className="btn btn-secondary">
          &larr; back to deck
        </Link>
        <RunAgainButton deckId={run.deck_id} />
      </div>
    </>
  )
}

function RunAgainButton({ deckId }: { deckId: number }) {
  const navigate = useNavigate()
  const startRun = useStartRun()
  const onClick = async () => {
    try {
      const run = await startRun.mutateAsync(deckId)
      navigate(`/runs/${run.id}`)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not start run.')
    }
  }
  return (
    <button onClick={onClick} disabled={startRun.isPending} className="btn btn-stamp">
      {startRun.isPending ? 'starting…' : 'Run again →'}
    </button>
  )
}
