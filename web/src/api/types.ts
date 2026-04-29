// Mirror of app/schemas.py. Keep these in sync with the backend.

export type User = {
  id: number
  email: string
  created_at: string
}

export type AuthOut = {
  user: User
  csrf_token: string
}

export type Deck = {
  id: number
  name: string
  source_filename: string | null
  created_at: string
}

export type DeckSummary = Deck & { card_count: number }

export type DeckCreateOut = { deck: Deck }

export type Card = {
  id: number
  deck_id: number
  question: string
  answer: string
  concept: string
  base_difficulty: number
  mastery: number
  last_reviewed_at: string | null
}

export type RunSummary = {
  id: number
  deck_id: number
  started_at: string
  ended_at: string | null
  score: number
  turn: number
  status: 'in_progress' | 'won' | 'lost'
}

export type DeckDetail = {
  deck: Deck
  cards: Card[]
  runs: RunSummary[]
}

export type Run = {
  id: number
  deck_id: number
  starting_hp: number
  hp: number
  score: number
  streak: number
  turn: number
  status: 'in_progress' | 'won' | 'lost'
  buffs: string[]
}

export type RunEvent = {
  correct: boolean
  grade: number
  feedback: string
  hp_delta: number
  score_delta: number
  buff_awarded: string | null
  shield_used: boolean
}

export type Attempt = {
  id: number
  card_id: number
  user_answer: string
  grade: number
  correct: boolean
  feedback: string
  turn: number
  created_at: string
}

export type RunState = {
  run: Run
  card: Card | null
  last_event: RunEvent | null
  last_card: Card | null
  hint: string | null
}

export type RunResults = {
  run: Run
  attempts: Attempt[]
}

export function isResults(x: RunState | RunResults): x is RunResults {
  return 'attempts' in x
}
