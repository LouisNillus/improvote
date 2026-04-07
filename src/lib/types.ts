export type VoteTeam = 'A' | 'B' | 'neutral' | null

export interface Round {
  id: string
  votesA: number
  votesB: number
  votesNeutral: number
  allowNeutral: boolean
  voterCount: number
  status: 'voting' | 'closed'
  duration: number
  startTime: number
  endTime: number
}

export interface Session {
  id: string
  teamA: string
  teamB: string
  rounds: Round[]
  status: 'active' | 'finished'
  locked: boolean
  code: string
  createdAt: number
  scoreA: number
  scoreB: number
}
