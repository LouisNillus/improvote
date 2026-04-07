export type VoteTeam = 'A' | 'B' | 'neutral' | null

// values[i] ∈ [-1, 1] : -1 = 100% team A, +1 = 100% team B, 0 = 50/50
export interface SimulationConfig {
  voterCount: number
  values: number[]  // one per round
}

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
  colorA: string
  colorB: string
  status: 'active' | 'finished'
  locked: boolean
  code: string
  createdAt: number
  lastActivity: number
  scoreA: number
  scoreB: number
}
