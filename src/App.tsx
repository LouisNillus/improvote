import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Admin from './pages/Admin'
import Vote from './pages/Vote'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/:id" element={<Admin />} />
        <Route path="/vote/:id" element={<Vote />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen spotlight-bg flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div style={{ fontSize: '3rem' }}>🎭</div>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p style={{ color: 'var(--muted)' }}>Cette session n'existe peut-être plus.</p>
      <a href="/" className="btn btn-primary mt-2">Retour à l'accueil</a>
    </div>
  )
}
