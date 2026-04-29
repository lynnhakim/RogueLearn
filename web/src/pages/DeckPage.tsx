import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useDeck, useDeleteCard, useDeleteDeck, useStartRun } from '../api/hooks'
import { PaperCard, StickyTag } from '../components/ui'

const ROTATIONS = [-1.4, 1.2, -0.8, 1.6, -1.8, 0.8, -1.2, 1.4]

export function DeckPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const id = Number(deckId)
  const navigate = useNavigate()
  const deck = useDeck(id)
  const deleteCard = useDeleteCard(id)
  const deleteDeck = useDeleteDeck()
  const startRun = useStartRun()

  const onStartRun = async () => {
    try {
      const run = await startRun.mutateAsync(id)
      navigate(`/runs/${run.id}`)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not start run.')
    }
  }

  const onDeleteDeck = async () => {
    if (!deck.data) return
    const name = deck.data.deck.name
    const runCount = deck.data.runs.length
    const msg = runCount > 0
      ? `Delete "${name}"? This also wipes ${runCount} run${runCount === 1 ? '' : 's'} and all attempts.`
      : `Delete "${name}"?`
    if (!confirm(msg)) return
    try {
      await deleteDeck.mutateAsync(id)
      navigate('/')
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not delete deck.')
    }
  }

  if (deck.isLoading) return <div className="text-[#2d2d2d]/60 italic">loading…</div>
  if (deck.error || !deck.data) return <div className="paper-card postit-pink p-6">Deck not found.</div>

  const { deck: d, cards, runs } = deck.data

  return (
    <>
      <Link to="/" className="text-sm text-[#2d2d2d]/60 hover:text-[#ff4d4d] inline-block mb-4">
        &larr; all decks
      </Link>

      <section className="flex items-end justify-between flex-wrap gap-4 mb-3">
        <h1 className="heading text-4xl md:text-6xl">
          <span className="wavy">{d.name}</span>
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onDeleteDeck}
            disabled={deleteDeck.isPending}
            className="btn btn-ghost text-sm text-[#2d2d2d]/55 hover:text-[#ff4d4d]"
          >
            {deleteDeck.isPending ? 'deleting…' : 'delete deck'}
          </button>
          <button onClick={onStartRun} disabled={startRun.isPending || cards.length === 0} className="btn btn-stamp">
            {startRun.isPending ? 'starting…' : 'Start run →'}
          </button>
        </div>
      </section>

      <p className="text-lg text-[#2d2d2d]/70 italic mb-10">
        {cards.length} cards · {d.source_filename ?? 'no source'}
      </p>

      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="heading text-2xl md:text-3xl">Cards</h2>
          <StickyTag color="#cde6ff" rotation={-3}>{cards.length} total</StickyTag>
        </div>

        {cards.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {cards.map((c, i) => {
              const rot = ROTATIONS[i % ROTATIONS.length]
              return (
                <li
                  key={c.id}
                  className="paper-card p-5 relative transition-transform duration-100 hover:rotate-0"
                  style={{ transform: `rotate(${rot}deg)` }}
                >
                  <div className="absolute -top-3 -right-3">
                    <StickyTag rotation={4}>{c.concept || '—'}</StickyTag>
                  </div>
                  <div className="heading text-lg md:text-xl mb-2 pr-12">{c.question}</div>
                  <div className="text-base text-[#2d2d2d]/75 mb-3 italic">{c.answer}</div>
                  <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#2d2d2d]/55">
                    <span>
                      diff {c.base_difficulty.toFixed(1)} · mastery {Math.round(c.mastery * 100)}%
                    </span>
                    <button
                      onClick={() => deleteCard.mutate(c.id)}
                      className="btn btn-ghost text-[#2d2d2d]/50 hover:text-[#ff4d4d] text-xs"
                    >
                      delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <PaperCard variant="postit-pink" rotation={-1} className="p-8 text-center">
            <div className="heading text-2xl mb-1">No cards extracted</div>
            <div className="text-base text-[#2d2d2d]/70">Try a richer notes file.</div>
          </PaperCard>
        )}
      </section>

      {runs.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="heading text-2xl md:text-3xl">Recent runs</h2>
            <StickyTag color="#e8d8ff" rotation={2}>ledger</StickyTag>
          </div>
          <ul className="space-y-3">
            {runs.map((r, i) => {
              const tilt = i % 2 === 0 ? -0.4 : 0.4
              return (
                <li
                  key={r.id}
                  className="paper-card alt p-4 flex items-center justify-between gap-4"
                  style={{ transform: `rotate(${tilt}deg)` }}
                >
                  <Link to={`/runs/${r.id}`} className="flex items-center gap-3 hover:text-[#ff4d4d]">
                    <span className="heading text-lg">Run #{r.id}</span>
                    <span className="text-sm text-[#2d2d2d]/55">
                      {new Date(r.started_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2 text-sm">
                    {r.status === 'won' ? (
                      <StickyTag color="#cde6ff" rotation={-2}>CLEARED</StickyTag>
                    ) : r.status === 'lost' ? (
                      <StickyTag color="#ffd4d4" rotation={2}>DIED</StickyTag>
                    ) : (
                      <StickyTag color="#fff9c4" rotation={-1}>in progress</StickyTag>
                    )}
                    <span className="heading text-lg">{r.score}</span>
                    <span className="text-xs uppercase tracking-wider opacity-55">
                      pts · {r.turn} turns
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
