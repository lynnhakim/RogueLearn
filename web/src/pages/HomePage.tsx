import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useDecks, useUploadDeck } from '../api/hooks'
import { HandArrow, PaperCard, StickyTag, Tack, Tape } from '../components/ui'

const ROTATIONS = [-2.2, 1.4, -1.0, 2.0, -1.6, 1.0, -0.6, 1.8, -2.4]
const DECORATIONS: Array<'tack' | 'tape' | 'none'> = ['tack', 'tape', 'tack', 'none', 'tape', 'tack', 'tape', 'none', 'tack']
const BGS: Array<undefined | 'postit' | 'postit-blue' | 'postit-pink' | 'postit-violet'> = [
  undefined, 'postit', undefined, 'postit-blue', undefined, 'postit-pink', undefined, 'postit-violet', undefined,
]

export function HomePage() {
  const decks = useDecks()
  const upload = useUploadDeck()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onUpload = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError('Pick a file first.')
      return
    }
    try {
      const { deck } = await upload.mutateAsync({ name, file })
      navigate(`/decks/${deck.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.')
    }
  }

  return (
    <>
      <section className="mb-16 relative">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-2">
          <h1 className="heading text-5xl md:text-6xl">Your <span className="wavy">decks</span></h1>
          <span
            className="hidden md:inline-block text-base text-[#2d2d2d]/60 italic mb-2"
            style={{ transform: 'rotate(-1.5deg)' }}
          >
            drag, drop, conquer
          </span>
        </div>
        <p className="text-lg md:text-xl text-[#2d2d2d]/75 mb-10">
          Drop in some notes — get atomic flashcards — survive a run.
        </p>

        {decks.isLoading ? (
          <div className="text-[#2d2d2d]/60 italic">loading decks…</div>
        ) : decks.data && decks.data.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {decks.data.map((d, i) => {
              const rot = ROTATIONS[i % ROTATIONS.length]
              const deco = DECORATIONS[i % DECORATIONS.length]
              const bg = BGS[i % BGS.length]
              return (
                <Link
                  key={d.id}
                  to={`/decks/${d.id}`}
                  className={`block paper-card ${bg ?? ''} p-6 transition-transform duration-100 hover:-rotate-1`}
                  style={{ transform: `rotate(${rot}deg)` }}
                >
                  {deco === 'tack' && <Tack />}
                  {deco === 'tape' && <Tape rotation={rot * -1.5} />}
                  <div className="heading text-2xl md:text-3xl mb-2 leading-tight">{d.name}</div>
                  <div className="text-base text-[#2d2d2d]/70 flex items-center justify-between">
                    <span>{d.card_count} cards</span>
                    <span className="text-xs uppercase tracking-wider opacity-60">
                      {new Date(d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <PaperCard variant="postit" rotation={-1.5} className="p-10 text-center max-w-xl mx-auto">
            <Tack />
            <div className="heading text-3xl mb-2">No decks yet!</div>
            <div className="text-lg text-[#2d2d2d]/75">Toss in some notes below ↓</div>
          </PaperCard>
        )}
      </section>

      <section className="relative">
        <HandArrow className="hidden md:block absolute -top-12 -right-4 w-32 h-16 -rotate-12" />

        <PaperCard alt rotation={-0.6} className="p-8 md:p-10 max-w-2xl mx-auto">
          <Tape />
          <div className="flex items-baseline justify-between flex-wrap gap-3 mb-1">
            <h2 className="heading text-3xl md:text-4xl">New deck from notes</h2>
            <StickyTag rotation={3}>AI does the rest</StickyTag>
          </div>
          <p className="text-base md:text-lg text-[#2d2d2d]/65 italic mb-7">
            .md, .txt, or .pdf — anything you've already written
          </p>

          <form onSubmit={onUpload} className="space-y-5">
            <div>
              <label className="heading block text-lg mb-2">Deck name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. ML midterm cram"
                className="input"
              />
            </div>
            <div>
              <label className="heading block text-lg mb-2">Notes file</label>
              <input
                type="file"
                accept=".md,.txt,.pdf,.markdown"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="input"
              />
            </div>

            {error && (
              <div className="paper-card postit-pink p-3 text-base shake" style={{ transform: 'rotate(-0.5deg)' }}>
                {error}
              </div>
            )}

            <div className="flex items-center gap-4 flex-wrap pt-2">
              <button type="submit" disabled={upload.isPending} className="btn">
                {upload.isPending ? 'extracting…' : 'Extract cards →'}
              </button>
              <span className="text-sm text-[#2d2d2d]/60 italic">~10–30s depending on file size</span>
            </div>
          </form>
        </PaperCard>
      </section>
    </>
  )
}
