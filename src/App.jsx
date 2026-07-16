import { useCallback, useEffect, useMemo, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { GameScreen } from "./components/GameScreen";
import { HomeScreen } from "./components/HomeScreen";
import { ResultScreen } from "./components/ResultScreen";
import { useTravelData } from "./hooks/useTravelData";
import { useGameStore } from "./store/useGameStore";
import { GAME_TYPES } from "./lib/gameTypes";
import {
  buildGeoModel,
  getFreeRideStops,
  getGrandTourStops,
  getRouteStops,
  projectStops,
} from "./lib/geo";
import {
  TYPING_LANGUAGES,
  getTypingTarget,
  isTypingCharacterMatch,
  normalizeCommittedText,
} from "./lib/typing";

const TIMED_MS = 30000;
const ARRIVAL_POPUP_MS = 1200;

// 모바일 백스페이스 안정적 감지를 위한 시드 문자
const INPUT_SEED = "\u200B";

export default function App() {
  const { data, topology, error } = useTravelData();
  const geoModel = useMemo(() => (topology ? buildGeoModel(topology) : null), [topology]);

  const {
    screen, setScreen,
    gameType, setGameType,
    selectedRouteId, setSelectedRouteId,
    timerMode, setTimerMode,
    typingLanguage, setTypingLanguage,
    dark, setDark,
    stopIndex, typedIndex, correct, errors, combo, maxCombo, completed, elapsedMs, shake, compositionText, arrivalStop, runStops,
    setGameState, resetGameState
  } = useGameStore();

  const startTimeRef = useRef(0);
  const typingInputRef = useRef(null);
  const gameActiveRef = useRef(false);
  const isComposingRef = useRef(false);
  const typedIndexRef = useRef(0);
  const stopIndexRef = useRef(0);
  const arrivalTimerRef = useRef(null);

  const attempts = correct + errors;
  const elapsed = Math.floor(elapsedMs / 1000);
  const remaining = Math.max(Math.ceil((TIMED_MS - elapsedMs) / 1000), 0);
  const minutes = Math.max(elapsedMs, 2000) / 60000;
  const metrics = {
    speed:
      typingLanguage === TYPING_LANGUAGES.KOREAN
        ? Math.round(correct / minutes)
        : Math.round(correct / 5 / minutes),
    speedUnit: typingLanguage === TYPING_LANGUAGES.KOREAN ? "타/분" : "WPM",
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 100,
    combo: combo,
    maxCombo: maxCombo,
  };
  const showSiteChrome = screen !== "game";

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    return () => clearTimeout(arrivalTimerRef.current);
  }, []);

  const resetTypingInput = useCallback(() => {
    isComposingRef.current = false;
    if (typingInputRef.current) typingInputRef.current.value = INPUT_SEED;
    setGameState({ compositionText: "" });
  }, [setGameState]);

  const buildRunStops = useCallback(() => {
    if (!data || !geoModel) return [];
    let stops;
    if (gameType === GAME_TYPES.GRAND_TOUR) stops = getGrandTourStops(data.routes);
    else if (gameType === GAME_TYPES.FREE_RIDE) stops = getFreeRideStops(data.routes);
    else stops = getRouteStops(data.routes, selectedRouteId);
    return projectStops(stops, geoModel.projection);
  }, [data, gameType, geoModel, selectedRouteId]);

  const startGame = useCallback(() => {
    const stops = buildRunStops();
    if (!stops.length) return;

    resetGameState();
    setGameState({ runStops: stops });
    resetTypingInput();

    gameActiveRef.current = true;
    typingInputRef.current?.focus({ preventScroll: true });
    typedIndexRef.current = 0;
    stopIndexRef.current = 0;

    startTimeRef.current = performance.now();
    setScreen("game");
  }, [buildRunStops, resetGameState, setGameState, resetTypingInput, setScreen]);

  const backToHome = useCallback(() => {
    gameActiveRef.current = false;
    resetTypingInput();
    typingInputRef.current?.blur();
    clearTimeout(arrivalTimerRef.current);
    setGameState({ arrivalStop: null });
    setScreen("home");
  }, [resetTypingInput, setGameState, setScreen]);

  const finishGame = useCallback(() => {
    if (!gameActiveRef.current) return;
    gameActiveRef.current = false;
    resetTypingInput();
    typingInputRef.current?.blur();
    const ms = performance.now() - startTimeRef.current;
    setGameState({ elapsedMs: timerMode === "timed" ? Math.min(ms, TIMED_MS) : ms });
    setScreen("result");
  }, [resetTypingInput, timerMode, setGameState, setScreen]);

  useEffect(() => {
    if (screen !== "game") return undefined;
    const timer = setInterval(() => {
      const ms = performance.now() - startTimeRef.current;
      setGameState({ elapsedMs: timerMode === "timed" ? Math.min(ms, TIMED_MS) : ms });
    }, 200);
    return () => clearInterval(timer);
  }, [screen, timerMode, setGameState]);

  useEffect(() => {
    if (screen === "game" && timerMode === "timed" && elapsedMs >= TIMED_MS) finishGame();
  }, [elapsedMs, finishGame, screen, timerMode]);

  useEffect(() => {
    if (screen === "game" && data && geoModel && runStops.length === 0) {
      setScreen("home");
    }
  }, [screen, data, geoModel, runStops, setScreen]);

  const advanceStop = useCallback(() => {
    const currentIndex = stopIndexRef.current;

    setGameState({ completed: completed + 1 });
    clearTimeout(arrivalTimerRef.current);
    setGameState({ arrivalStop: null });

    if (currentIndex >= runStops.length - 1) {
      finishGame();
      return;
    }
    const nextIndex = currentIndex + 1;
    typedIndexRef.current = 0;
    stopIndexRef.current = nextIndex;
    setGameState({ stopIndex: nextIndex, typedIndex: 0 });
  }, [finishGame, runStops, completed, setGameState]);

  const deleteCharacter = useCallback(() => {
    if (!gameActiveRef.current) return;
    if (arrivalStop) return;
    if (typedIndexRef.current <= 0) return;

    typedIndexRef.current -= 1;
    setGameState({
      typedIndex: typedIndexRef.current,
      correct: Math.max(0, useGameStore.getState().correct - 1),
      combo: 0,
    });
  }, [arrivalStop, setGameState]);

  const typeCharacter = useCallback(
    (character) => {
      if (!gameActiveRef.current || [...character].length !== 1) return;
      const stop = runStops[stopIndexRef.current];
      if (!stop) return;
      const target = getTypingTarget(stop, typingLanguage);
      const targetCharacters = [...target];
      const expected = targetCharacters[typedIndexRef.current];

      if (isTypingCharacterMatch(character, expected, typingLanguage)) {
        typedIndexRef.current += 1;

        const newCombo = combo + 1;
        const newMaxCombo = Math.max(maxCombo, newCombo);

        setGameState({
          correct: correct + 1,
          combo: newCombo,
          maxCombo: newMaxCombo
        });

        if (typedIndexRef.current >= targetCharacters.length) {
          setGameState({ typedIndex: typedIndexRef.current });
          const arrived = runStops[stopIndexRef.current];
          setGameState({ arrivalStop: arrived });
          arrivalTimerRef.current = setTimeout(advanceStop, ARRIVAL_POPUP_MS);
        } else {
          setGameState({ typedIndex: typedIndexRef.current });
        }
      } else {
        setGameState({
          errors: errors + 1,
          shake: false,
          combo: 0
        });
        requestAnimationFrame(() => setGameState({ shake: true }));
        setTimeout(() => setGameState({ shake: false }), 170);
      }
    },
    [advanceStop, runStops, typingLanguage, correct, errors, combo, maxCombo, setGameState],
  );

  // ==================== 개선된 입력 처리 ====================
  const consumeTypingInput = useCallback(
    (input) => {
      const raw = input.value;

      // 백스페이스 감지
      if (!raw.startsWith(INPUT_SEED)) {
        input.value = INPUT_SEED;
        setGameState({ compositionText: "" });
        deleteCharacter();
        return;
      }

      const value = raw.slice(INPUT_SEED.length);
      if (!value) {
        input.value = INPUT_SEED;
        return;
      }

      const characters = normalizeCommittedText(value, typingLanguage);
      input.value = INPUT_SEED;                    // 즉시 초기화
      setGameState({ compositionText: "" });

      for (const character of characters) {
        typeCharacter(character);
      }
    },
    [typeCharacter, deleteCharacter, typingLanguage, setGameState],
  );

  const handleTypingInput = useCallback(
    (event) => {
      if (isComposingRef.current || event.nativeEvent?.isComposing) {
        const raw = event.currentTarget.value;
        setGameState({
          compositionText: raw.startsWith(INPUT_SEED) ? raw.slice(INPUT_SEED.length) : raw
        });
        return;
      }
      consumeTypingInput(event.currentTarget);
    },
    [consumeTypingInput, setGameState],
  );

  const handleCompositionStart = useCallback((event) => {
    isComposingRef.current = true;
    const raw = event.currentTarget.value;
    setGameState({
      compositionText: raw.startsWith(INPUT_SEED) ? raw.slice(INPUT_SEED.length) : raw
    });
  }, [setGameState]);

  const handleCompositionEnd = useCallback(
    (event) => {
      isComposingRef.current = false;
      setGameState({ compositionText: "" });
      consumeTypingInput(event.currentTarget);
    },
    [consumeTypingInput, setGameState],
  );

  // ==================== 키보드 이벤트 ====================
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape") {
        if (screen === "game") backToHome();
        return;
      }
      if (screen !== "game") return;

      if (event.key === "Backspace") {
        if (event.target === typingInputRef.current) return;
        event.preventDefault();
        deleteCharacter();
        return;
      }

      if (
        event.target === typingInputRef.current ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.length !== 1
      )
        return;

      if (event.key === " ") event.preventDefault();
      typeCharacter(event.key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [backToHome, deleteCharacter, screen, typeCharacter]);

  const currentTarget = runStops[stopIndex] ? getTypingTarget(runStops[stopIndex], typingLanguage) : "";

  return (
    <div className="app-shell">
      <input
        ref={typingInputRef}
        className="mobile-typing-input"
        type="text"
        defaultValue={INPUT_SEED}
        inputMode="text"
        lang={typingLanguage === TYPING_LANGUAGES.KOREAN ? "ko" : "en"}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={typingLanguage === TYPING_LANGUAGES.KOREAN ? "한글 지명 입력" : "영문 지명 입력"}
        aria-describedby={screen === "game" ? "typing-instruction" : undefined}
        onInput={handleTypingInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />

      {showSiteChrome ? (
        <header className="topbar">
          <button className="brand" type="button" onClick={backToHome} aria-label="홈으로">
            <span>MY TRAVEL TYPING</span>
          </button>
          <div className="top-actions">
            <button
              className="icon-button"
              type="button"
              aria-pressed={dark}
              aria-label="다크모드 전환"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>
      ) : null}

      <main>
        {error ? <DataError message={error.message} /> : null}
        {!error && (!data || !geoModel) ? (
          <div className="loading">
            <span />
            여행 데이터를 불러오는 중…
          </div>
        ) : null}

        {data && geoModel && screen === "home" ? (
          <HomeScreen
            routes={data.routes}
            gameType={gameType}
            onGameTypeChange={setGameType}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            timerMode={timerMode}
            onTimerModeChange={setTimerMode}
            typingLanguage={typingLanguage}
            onTypingLanguageChange={setTypingLanguage}
            onStart={startGame}
          />
        ) : null}

        {data && geoModel && screen === "game" && runStops.length ? (
          <GameScreen
            countries={geoModel.countries}
            stops={runStops}
            stopIndex={stopIndex}
            typedIndex={typedIndex}
            target={currentTarget}
            typingLanguage={typingLanguage}
            compositionText={compositionText}
            completed={completed}
            remaining={remaining}
            elapsed={elapsed}
            mode={timerMode}
            metrics={metrics}
            shake={shake}
            arrivalStop={arrivalStop}
            onBack={backToHome}
            onFocusTyping={() => typingInputRef.current?.focus({ preventScroll: true })}
          />
        ) : null}

        {screen === "result" ? (
          <ResultScreen
            elapsed={elapsed}
            completed={completed}
            metrics={metrics}
            onBack={backToHome}
            onRetry={startGame}
          />
        ) : null}
      </main>

      {showSiteChrome ? (
        <footer>
          <div className="footer-brand">
            <span className="footer-wordmark">MY TRAVEL TYPING</span>
          </div>
          <div className="footer-meta">
            <p>
              <span className="footer-label">BASED ON</span>내 여행 기록 · France · Switzerland · Italy
            </p>
            <p>
              Fork of{" "}
              <a href="https://github.com/ridemountainpig/tw-metro-typing" target="_blank" rel="noreferrer">
                tw-metro-typing
              </a>
            </p>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function DataError({ message }) {
  return (
    <div className="data-error">
      <strong>데이터 로딩 실패</strong>
      <span>{message}</span>
      <button type="button" onClick={() => location.reload()}>
        새로고침
      </button>
    </div>
  );
}