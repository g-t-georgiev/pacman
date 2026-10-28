/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameMode, HighScoreRecord } from '../types/game';

const STORAGE_KEY = 'arcade_pacman_high_scores_v1';

const DEFAULT_SCORES: HighScoreRecord[] = [
  { id: '1', name: 'PAC', score: 10000, mode: 'PACMAN', level: 3, date: '1980-05-22' },
  { id: '2', name: 'MID', score: 8400, mode: 'MS_PACMAN', level: 2, date: '1982-01-13' },
  { id: '3', name: 'OTT', score: 6200, mode: 'CRAZY_OTTO', level: 2, date: '1981-10-15' },
  { id: '4', name: 'BAK', score: 5500, mode: 'COOKIE_MAN', level: 2, date: '2026-03-01' },
  { id: '5', name: 'ARC', score: 3200, mode: 'PACMAN', level: 1, date: '1980-06-01' },
];

export function getStoredHighScores(): HighScoreRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCORES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SCORES;
  } catch {
    return DEFAULT_SCORES;
  }
}

export function saveHighScore(record: Omit<HighScoreRecord, 'id' | 'date'>): HighScoreRecord[] {
  const current = getStoredHighScores();
  const newRecord: HighScoreRecord = {
    ...record,
    id: `score_${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
  };

  const updated = [...current, newRecord]
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }

  return updated;
}

interface HighScoresModalProps {
  onClose: () => void;
  pendingNewScore?: { score: number; mode: GameMode; level: number } | null;
  onScoreSubmitted?: () => void;
}

export const HighScoresModal: React.FC<HighScoresModalProps> = ({
  onClose,
  pendingNewScore,
  onScoreSubmitted,
}) => {
  const [scores, setScores] = useState<HighScoreRecord[]>(getStoredHighScores());
  const [filterMode, setFilterMode] = useState<GameMode | 'ALL'>('ALL');
  const [initials, setInitials] = useState<string>('PAC');

  const handleSaveNewScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingNewScore) return;

    const trimmed = (initials.trim() || 'AAA').toUpperCase().slice(0, 3);
    const updated = saveHighScore({
      name: trimmed,
      score: pendingNewScore.score,
      mode: pendingNewScore.mode,
      level: pendingNewScore.level,
    });
    setScores(updated);
    if (onScoreSubmitted) {
      onScoreSubmitted();
    }
  };

  const handleResetScores = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setScores(DEFAULT_SCORES);
  };

  const filtered = filterMode === 'ALL' ? scores : scores.filter((s) => s.mode === filterMode);

  return (
    <div className="w-full max-w-md bg-neutral-950 border border-yellow-500/60 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 font-mono text-white">
        {/* Title */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-widest text-yellow-400">🏆 HIGH SCORES</span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white px-2 py-0.5 rounded hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        {/* New High Score Prompt */}
        {pendingNewScore && (
          <form
            onSubmit={handleSaveNewScore}
            className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/40 flex flex-col gap-2 text-center"
          >
            <div className="text-yellow-400 font-bold text-sm">✨ NEW HIGH SCORE! ✨</div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {pendingNewScore.score.toLocaleString()} PTS
            </div>
            <div className="text-xs text-neutral-300">
              Enter your 3-letter arcade initials:
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <input
                type="text"
                maxLength={3}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                autoFocus
                className="w-24 text-center text-xl font-bold bg-neutral-900 border border-yellow-400 text-yellow-400 rounded py-1 tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-yellow-300"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs rounded transition-all"
              >
                SAVE
              </button>
            </div>
          </form>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center justify-between gap-1 p-1 bg-neutral-900 rounded-lg text-[10px]">
          {(['ALL', 'PACMAN', 'MS_PACMAN', 'CRAZY_OTTO', 'COOKIE_MAN'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                filterMode === m ? 'bg-yellow-500 text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {m === 'ALL'
                ? 'ALL'
                : m === 'PACMAN'
                ? 'PAC-MAN'
                : m === 'MS_PACMAN'
                ? 'MS. PAC'
                : m === 'CRAZY_OTTO'
                ? 'OTTO'
                : 'COOKIE'}
            </button>
          ))}
        </div>

        {/* Score Table */}
        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
          <div className="grid grid-cols-12 text-[10px] text-neutral-500 font-semibold px-2 pb-1 border-b border-neutral-800">
            <span className="col-span-2">RANK</span>
            <span className="col-span-3">NAME</span>
            <span className="col-span-4 text-right">SCORE</span>
            <span className="col-span-3 text-right">LEVEL</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center text-neutral-500 py-6 text-xs">No records yet.</div>
          ) : (
            filtered.map((record, idx) => {
              const isTop = idx === 0;
              return (
                <div
                  key={record.id}
                  className={`grid grid-cols-12 text-xs items-center px-2 py-1 rounded ${
                    isTop ? 'bg-yellow-500/10 text-yellow-300 font-bold' : 'text-neutral-300 hover:bg-neutral-900'
                  }`}
                >
                  <span className="col-span-2 text-neutral-500">#{idx + 1}</span>
                  <span className="col-span-3 font-bold tracking-wider">{record.name}</span>
                  <span className="col-span-4 text-right tabular-nums font-semibold">
                    {record.score.toLocaleString()}
                  </span>
                  <span className="col-span-3 text-right text-neutral-400 text-[11px]">
                    LVL {record.level}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[11px]">
          <button
            onClick={handleResetScores}
            className="text-neutral-500 hover:text-red-400 transition-colors"
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
  );
};
