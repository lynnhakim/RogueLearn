import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { useCsrfToken } from '../auth/AuthContext'
import type {
  DeckCreateOut,
  DeckDetail,
  DeckSummary,
  Run,
  RunResults,
  RunState,
} from './types'

// ---------- Decks --------------------------------------------------------
export function useDecks() {
  return useQuery({
    queryKey: ['decks'],
    queryFn: () => api<DeckSummary[]>('/api/decks'),
  })
}

export function useDeck(deckId: number) {
  return useQuery({
    queryKey: ['deck', deckId],
    queryFn: () => api<DeckDetail>(`/api/decks/${deckId}`),
    enabled: Number.isFinite(deckId),
  })
}

export function useUploadDeck() {
  const csrf = useCsrfToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) => {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('file', file)
      return api<DeckCreateOut>('/api/decks/upload', {
        method: 'POST',
        body: fd,
        raw: true,
        csrfToken: csrf,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['decks'] }),
  })
}

export function useDeleteCard(deckId: number) {
  const csrf = useCsrfToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cardId: number) =>
      api<void>(`/api/decks/${deckId}/cards/${cardId}`, { method: 'DELETE', csrfToken: csrf }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deck', deckId] }),
  })
}

export function useDeleteDeck() {
  const csrf = useCsrfToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deckId: number) =>
      api<void>(`/api/decks/${deckId}`, { method: 'DELETE', csrfToken: csrf }),
    onSuccess: (_data, deckId) => {
      qc.invalidateQueries({ queryKey: ['decks'] })
      qc.removeQueries({ queryKey: ['deck', deckId] })
    },
  })
}

// ---------- Runs ---------------------------------------------------------
export function useStartRun() {
  const csrf = useCsrfToken()
  return useMutation({
    mutationFn: (deckId: number) =>
      api<Run>(`/api/decks/${deckId}/runs`, { method: 'POST', csrfToken: csrf }),
  })
}

export function useRun(runId: number) {
  return useQuery({
    queryKey: ['run', runId],
    queryFn: () => api<RunState | RunResults>(`/api/runs/${runId}`),
    enabled: Number.isFinite(runId),
  })
}

export function useSubmitAnswer(runId: number) {
  const csrf = useCsrfToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, answer }: { cardId: number; answer: string }) =>
      api<RunState | RunResults>(`/api/runs/${runId}/answer`, {
        body: { card_id: cardId, answer },
        csrfToken: csrf,
      }),
    onSuccess: (data) => qc.setQueryData(['run', runId], data),
  })
}

export function useUseHeal(runId: number) {
  const csrf = useCsrfToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<Run>(`/api/runs/${runId}/heal`, { method: 'POST', csrfToken: csrf }),
    onSuccess: (run) => {
      // Patch the embedded run object in whatever the run-state cache currently holds.
      qc.setQueryData<RunState | RunResults | undefined>(['run', runId], (prev) => {
        if (!prev) return prev
        return { ...prev, run }
      })
    },
  })
}

export function useUseHint(runId: number) {
  const csrf = useCsrfToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cardId: number) =>
      api<RunState>(`/api/runs/${runId}/hint`, { body: { card_id: cardId }, csrfToken: csrf }),
    onSuccess: (data) => qc.setQueryData(['run', runId], data),
  })
}
