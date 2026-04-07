export type VoteTeam = 'A' | 'B' | 'neutral' | null

export type SimulationPattern =
  | 'balanced'
  | 'tight'
  | 'teamA_dominant'
  | 'teamB_dominant'
  | 'teamA_comeback'
  | 'teamB_comeback'

export interface SimulationConfig {
  voterCount: number
  roundCount: number
  pattern: SimulationPattern
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
