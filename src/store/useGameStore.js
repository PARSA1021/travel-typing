import { create } from 'zustand';
import { TYPING_LANGUAGES } from '../lib/typing';
import { GAME_TYPES } from '../lib/gameTypes';

export const useGameStore = create((set, get) => ({
  // Navigation & Settings
  screen: 'home',
  setScreen: (screen) => set({ screen }),

  gameType: GAME_TYPES.ROUTE,
  setGameType: (gameType) => set({ gameType }),

  selectedRouteId: null,
  setSelectedRouteId: (selectedRouteId) => set({ selectedRouteId }),

  timerMode: 'line',
  setTimerMode: (timerMode) => set({ timerMode }),

  typingLanguage: TYPING_LANGUAGES.KOREAN, // Defaulting to Korean (Beginner)
  setTypingLanguage: (typingLanguage) => set({ typingLanguage }),

  difficulty: 'beginner', // beginner, intermediate, advanced
  setDifficulty: (difficulty) => {
    let typingLanguage = TYPING_LANGUAGES.KOREAN;
    if (difficulty === 'advanced') {
      typingLanguage = TYPING_LANGUAGES.ENGLISH;
    }
    set({ difficulty, typingLanguage });
  },

  dark: false,
  setDark: (dark) => set({ dark }),

  soundOn: true,
  setSoundOn: (soundOn) => set({ soundOn }),

  // Game state
  stopIndex: 0,
  typedIndex: 0,
  correct: 0,
  errors: 0,
  combo: 0,
  maxCombo: 0,
  completed: 0,
  elapsedMs: 0,
  shake: false,
  compositionText: '',
  arrivalStop: null,
  runStops: [],

  // Game Actions
  setGameState: (state) => set((prev) => ({ ...prev, ...state })),
  resetGameState: () => set({
    stopIndex: 0,
    typedIndex: 0,
    correct: 0,
    errors: 0,
    combo: 0,
    maxCombo: 0,
    completed: 0,
    elapsedMs: 0,
    shake: false,
    compositionText: '',
    arrivalStop: null,
    runStops: []
  }),
}));