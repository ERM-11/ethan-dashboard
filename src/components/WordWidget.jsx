import React, { useState } from 'react'
import { BookOpen } from 'lucide-react'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { dayOfYear, todayISO } from '../config.js'
import { Card, PrimaryBtn, SecondaryBtn, Segmented, buzz, inputCls } from './ui.jsx'
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
    buzz()
    setStats({ ...stats, [key]: stats[key] + 1 })
    setVoteDate(todayISO())
  }
  const correct = guess.trim().toLowerCase() === word.word.toLowerCase()
  const reveal = () => {
    if (revealed) return
    buzz()
    setRevealed(true)
    setQuizStats({ quizAttempts: quizStats.quizAttempts + 1, quizCorrect: quizStats.quizCorrect + (correct ? 1 : 0) })
  }
  const blanked = (s) => s.replace(new RegExp(word.word, 'gi'), '______')
  const quizAcc = quizStats.quizAttempts ? Math.round((quizStats.quizCorrect / quizStats.quizAttempts) * 100) : null

  return (
    <Card icon={BookOpen} title="Word of the Day" right={
      <div className="flex items-center gap-2">
        {mode === 'quiz' && (
          <span
            className="num shrink-0 rounded-full bg-card2 border border-line px-2 py-0.5 text-xs text-mut"
            title={quizAcc === null ? 'No quiz attempts yet' : `${quizStats.quizCorrect}/${quizStats.quizAttempts} correct`}
          >
            {quizAcc === null ? '—' : `${quizAcc}%`}
          </span>
        )}
        <Segmented options={['learn', 'quiz']} value={mode} label="Word mode"
          onChange={(m) => { setMode(m); setRevealed(false); setGuess('') }} />
      </div>
    }>
      {mode === 'learn' || revealed ? (
        <div>
          <p className="font-display text-2xl font-bold">{word.word}</p>
          <p className="num text-xs text-mut">{word.pronunciation} · {word.partOfSpeech}</p>
        </div>
      ) : (
        <p className="text-sm text-mut">Guess the word from its definition:</p>
      )}
      <p className="text-sm">{mode === 'quiz' && !revealed ? blanked(word.definition) : word.definition}</p>
      <p className="text-sm italic text-mut">"{mode === 'quiz' && !revealed ? blanked(word.example) : word.example}"</p>

      {mode === 'quiz' && (
        <>
          {!revealed ? (
            <form onSubmit={(e) => { e.preventDefault(); reveal() }} className="flex gap-2">
              <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Your guess…" aria-label="Your guess"
                className={`flex-1 min-w-0 ${inputCls()}`} />
              <PrimaryBtn onClick={reveal}>Reveal</PrimaryBtn>
            </form>
          ) : (
            <p className={`text-sm font-medium ${correct ? 'text-emerald-400' : 'text-rose-400'}`} role="status">
              {correct ? '✓ Correct' : `✗ Not quite — the answer is "${word.word}"`}
            </p>
          )}
          <p className="text-xs text-mut">
            {quizStats.quizAttempts
              ? <>Quiz accuracy: <span className="num">{quizAcc}%</span> (<span className="num">{quizStats.quizCorrect}/{quizStats.quizAttempts}</span>)</>
              : 'No quiz attempts yet'}
          </p>
        </>
      )}

      <div className="flex items-center gap-2 border-t border-line pt-2">
        <SecondaryBtn onClick={() => vote('known')} ariaDisabled={voted}>I knew this one</SecondaryBtn>
        <SecondaryBtn onClick={() => vote('new')} ariaDisabled={voted}>New to me</SecondaryBtn>
        <span className="num ml-auto text-xs text-mut">
          {stats.known} known · {stats.new} new
        </span>
      </div>
      {voted && <p className="text-xs text-mut">Done for today ✓</p>}
    </Card>
  )
}
