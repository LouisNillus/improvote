export interface Round {
  id: string
  votesA: number
  votesB: number
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
  createdAt: number
  scoreA: number
  scoreB: number
}
