import React, { useState } from 'react'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { dayOfYear, todayISO } from '../config.js'
import { Card, PrimaryBtn, SecondaryBtn, focusRing } from './ui.jsx'
import vocab from '../data/vocabulary.json'

export default function WordWidget() {
  const word = vocab[dayOfYear() % vocab.length]
  const [mode, setMode] = useLocalStorage('dashboard_wordMode', 'learn')
  const [stats, setStats] = useLocalStorage('dashboard_wordStats', { known: 0, new: 0 })
  const [voteDate, setVoteDate] = useLocalStorage('dashboard_wordVoteDate', '')
  const [quizStats, setQuizStats] = useLocalStorage('dashboard_quizStats', { quizAttempts: 0, quizCorrect: 0 })
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)

  const voted = voteDate === todayISO()
  const vote = (key) => {
    if (voted) return
    setStats({ ...stats, [key]: stats[key] + 1 })
    setVoteDate(todayISO())
  }
  const correct = guess.trim().toLowerCase() === word.word.toLowerCase()
  const reveal = () => {
    if (revealed) return
    setRevealed(true)
    setQuizStats({ quizAttempts: quizStats.quizAttempts + 1, quizCorrect: quizStats.quizCorrect + (correct ? 1 : 0) })
  }
  const blanked = (s) => s.replace(new RegExp(word.word, 'gi'), '______')

  return (
    <Card icon="📖" title="Word of the Day" right={
      <div className="flex rounded-full border border-slate-300 dark:border-slate-600 overflow-hidden text-xs">
        {['learn', 'quiz'].map((m) => (
          <button key={m} onClick={() => { setMode(m); setRevealed(false); setGuess('') }}
            className={`px-3 py-1.5 min-h-[32px] capitalize ${focusRing} ${mode === m ? 'bg-blue-500 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            {m}
          </button>
        ))}
      </div>
    }>
      {mode === 'learn' || revealed ? (
        <div>
          <p className="font-display text-2xl font-bold">{word.word}</p>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{word.pronunciation} · {word.partOfSpeech}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Guess the word from its definition:</p>
      )}
      <p className="text-sm">{mode === 'quiz' && !revealed ? blanked(word.definition) : word.definition}</p>
      <p className="text-sm italic text-slate-600 dark:text-slate-300">"{mode === 'quiz' && !revealed ? blanked(word.example) : word.example}"</p>

      {mode === 'quiz' && (
        <>
          {!revealed ? (
            <form onSubmit={(e) => { e.preventDefault(); reveal() }} className="flex gap-2">
              <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Your guess…" aria-label="Your guess"
                className={`flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-2 text-sm ${focusRing}`} />
              <PrimaryBtn onClick={reveal}>Reveal</PrimaryBtn>
            </form>
          ) : (
            <p className={`text-sm font-medium ${correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} role="status">
              {correct ? '✓ Correct' : `✗ Not quite — the answer is "${word.word}"`}
            </p>
          )}
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Quiz accuracy: {quizStats.quizAttempts ? Math.round((quizStats.quizCorrect / quizStats.quizAttempts) * 100) : 0}% ({quizStats.quizCorrect}/{quizStats.quizAttempts})
          </p>
        </>
      )}

      <div className="flex items-center gap-2 border-t border-slate-300 dark:border-slate-700 pt-2">
        <SecondaryBtn onClick={() => vote('known')} ariaDisabled={voted}>I knew this one</SecondaryBtn>
        <SecondaryBtn onClick={() => vote('new')} ariaDisabled={voted}>New to me</SecondaryBtn>
        <span className="ml-auto font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {stats.known} known · {stats.new} new
        </span>
      </div>
      {voted && <p className="text-[11px] text-slate-500 dark:text-slate-400">Done for today ✓</p>}
    </Card>
  )
}
