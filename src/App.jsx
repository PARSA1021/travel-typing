import { useCallback, useEffect, useMemo, useRef } from "react";
import { Moon, Sun, Volume2, VolumeX } from "lucide-react";
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
  getRealDistanceKm
} from "./lib/geo";
import {
  TYPING_LANGUAGES,
  getTypingTarget,
  isTypingCharacterMatch,
  isIncompleteJamo,
  normalizeCommittedText,
} from "./lib/typing";
import { unlockAudio, playCorrectSound, playErrorSound, playArrivalSound, playComboSound, playDepartureSound } from "./lib/sound";
import { recordRun } from "./lib/stats";

const TIMED_MS = 30000;
const ADVANCE_DELAY_MS = 20;
const POPUP_VISIBLE_MS = 750;
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
    typingTargetMode, setTypingTargetMode,
    dark, setDark,
    soundOn, setSoundOn,
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
  const popupTimerRef = useRef(null);

  // correct/errors/combo/maxCombo을 매 키 입력마다 store에서 읽어오면(구독) 그
  // 값이 바뀔 때마다 typeCharacter 콜백 자체가 새로 생성되고, 이 콜백을
  // 의존성으로 갖는 전역 keydown 리스너(useEffect)도 매 타자마다
  // removeEventListener→addEventListener를 반복하게 된다. typedIndexRef와
  // 같은 방식으로 ref에 최신값을 들고 있다가 store에는 한 번에 반영만
  // 하도록 바꿔서, 콜백들이 게임 중엔 재생성되지 않게 만들었다.
  const statsRef = useRef({ correct: 0, errors: 0, combo: 0, maxCombo: 0, perfects: 0, wordErrors: 0 });

  const attempts = correct + errors;
  const elapsed = Math.floor(elapsedMs / 1000);
  const remaining = Math.max(Math.ceil((TIMED_MS - elapsedMs) / 1000), 0);
  const minutes = Math.max(elapsedMs, 2000) / 60000;
  
  const elapsedKm = useMemo(() => {
    let km = 0;
    if (!runStops || runStops.length === 0) return 0;
    for (let i = 1; i <= completed && i < runStops.length; i++) {
      km += getRealDistanceKm(runStops[i - 1].coordinates, runStops[i].coordinates);
    }
    return km;
  }, [runStops, completed]);

  const metrics = {
    speed:
      typingLanguage === TYPING_LANGUAGES.KOREAN
        ? Math.round(correct / minutes)
        : Math.round(correct / 5 / minutes),
    speedUnit: typingLanguage === TYPING_LANGUAGES.KOREAN ? "타/분" : "WPM",
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 100,
    combo: combo,
    maxCombo: maxCombo,
    distance: elapsedKm,
  };
  const showSiteChrome = screen !== "game";

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    return () => {
      clearTimeout(arrivalTimerRef.current);
      clearTimeout(popupTimerRef.current);
    };
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

    unlockAudio(); // "출발하기" 버튼 클릭은 확실한 사용자 제스처라 여기서 풀어둔다

    resetGameState();
    setGameState({ runStops: stops });
    resetTypingInput();

    gameActiveRef.current = true;
    typingInputRef.current?.focus({ preventScroll: true });
    typedIndexRef.current = 0;
    stopIndexRef.current = 0;
    statsRef.current = { correct: 0, errors: 0, combo: 0, maxCombo: 0, perfects: 0, wordErrors: 0 };

    startTimeRef.current = performance.now();
    setScreen("game");
  }, [buildRunStops, resetGameState, setGameState, resetTypingInput, setScreen]);

  const backToHome = useCallback(() => {
    gameActiveRef.current = false;
    resetTypingInput();
    typingInputRef.current?.blur();
    clearTimeout(arrivalTimerRef.current);
    clearTimeout(popupTimerRef.current);
    setGameState({ arrivalStop: null });
    setScreen("home");
  }, [resetTypingInput, setGameState, setScreen]);

  const finishGame = useCallback(() => {
    if (!gameActiveRef.current) return;
    gameActiveRef.current = false;
    resetTypingInput();
    typingInputRef.current?.blur();
    const ms = performance.now() - startTimeRef.current;
    const finalElapsedMs = timerMode === "timed" ? Math.min(ms, TIMED_MS) : ms;
    setGameState({ elapsedMs: finalElapsedMs });

    // 개인 기록 저장 - 코스/그랜드투어/자유주행 완주 판정은 stats.js가
    // gameType과 timerMode를 보고 알아서 처리한다.
    const finalMinutes = Math.max(finalElapsedMs, 2000) / 60000;
    const finalAttempts = statsRef.current.correct + statsRef.current.errors;
    const finalAccuracy = finalAttempts ? Math.round((statsRef.current.correct / finalAttempts) * 100) : 100;
    const finalSpeed =
      typingLanguage === TYPING_LANGUAGES.KOREAN
        ? Math.round(statsRef.current.correct / finalMinutes)
        : Math.round(statsRef.current.correct / 5 / finalMinutes);

    recordRun({
      completed,
      accuracy: finalAccuracy,
      speed: finalSpeed,
      typingLanguage,
      maxCombo: statsRef.current.maxCombo,
      routeId: selectedRouteId,
      gameType,
      timerMode,
    });

    setScreen("result");
  }, [resetTypingInput, timerMode, setGameState, setScreen, completed, typingLanguage, gameType, selectedRouteId]);

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
    if (soundOn) playDepartureSound();

    if (currentIndex >= runStops.length - 1) {
      clearTimeout(popupTimerRef.current);
      finishGame();
      return;
    }
    const nextIndex = currentIndex + 1;
    typedIndexRef.current = 0;
    stopIndexRef.current = nextIndex;
    statsRef.current.wordErrors = 0;
    setGameState({ stopIndex: nextIndex, typedIndex: 0 });
  }, [finishGame, runStops, completed, setGameState, soundOn]);

  // 방금 확정(commit)된 글자를 한 글자 되돌린다.
  const deleteCharacter = useCallback(() => {
    if (!gameActiveRef.current) return;
    if (typedIndexRef.current <= 0) return;

    typedIndexRef.current -= 1;
    const stats = statsRef.current;
    stats.correct = Math.max(0, stats.correct - 1);
    stats.combo = 0;
    stats.wordErrors += 1;
    setGameState({ typedIndex: typedIndexRef.current, correct: stats.correct, combo: 0 });
  }, [setGameState]);

  // 한글 입력 중(조합 세션이 아직 안 끝난) 상태에서 백스페이스를 누르면,
  // 브라우저 IME가 자모를 하나씩 지우기 시작해 "몽마르트르"의 마지막 음절이
  // 한 번에 안 지워지고 ㅡ, ㅌ 순으로 나눠 지워지는 문제가 있었다. 조합 중인
  // 입력창을 blur() 했다가 다시 focus()하면 대부분의 브라우저가 진행 중이던
  // 조합을 그 자리에서 통째로 취소한다 — 조합 취소의 표준적인 트릭이다.
  // (조합 중이던 음절은 아직 카운트에 반영된 적이 없으므로, 여기서는
  // 미리보기만 지우면 된다.)
  const cancelComposition = useCallback(() => {
    const input = typingInputRef.current;
    isComposingRef.current = false;
    setGameState({ compositionText: "" });
    if (!input) return;
    input.blur();
    // 브라우저가 blur 시 compositionend를 안 쏘는 극히 드문 경우를 대비한 안전장치.
    // compositionend가 정상적으로 먼저 발생했다면 아래는 그냥 같은 값을 다시
    // 써주는 셈이라 안전하다.
    input.value = INPUT_SEED;
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  }, [setGameState]);

  const typeCharacter = useCallback(
    (character) => {
      if (!gameActiveRef.current || [...character].length !== 1) return;
      const stop = runStops[stopIndexRef.current];
      if (!stop) return;
      const target = getTypingTarget(stop, typingLanguage, typingTargetMode);
      const targetCharacters = [...target];
      const expected = targetCharacters[typedIndexRef.current];
      const stats = statsRef.current;

      if (isTypingCharacterMatch(character, expected, typingLanguage)) {
        typedIndexRef.current += 1;
        stats.correct += 1;
        stats.combo += 1;
        stats.maxCombo = Math.max(stats.maxCombo, stats.combo);

        if (typedIndexRef.current >= targetCharacters.length) {
          const isPerfect = stats.wordErrors === 0;
          if (isPerfect) stats.perfects += 1;

          const arrived = runStops[stopIndexRef.current];
          setGameState({
            typedIndex: typedIndexRef.current,
            correct: stats.correct,
            combo: stats.combo,
            maxCombo: stats.maxCombo,
            perfects: stats.perfects,
            arrivalStop: arrived,
            isPerfectArrival: isPerfect,
          });
          if (soundOn) playArrivalSound(); // 마지막 글자는 클릭음 대신 도착음으로
          clearTimeout(arrivalTimerRef.current);
          clearTimeout(popupTimerRef.current);
          arrivalTimerRef.current = setTimeout(advanceStop, ADVANCE_DELAY_MS);
          popupTimerRef.current = setTimeout(() => setGameState({ arrivalStop: null, isPerfectArrival: false }), POPUP_VISIBLE_MS);
        } else {
          setGameState({
            typedIndex: typedIndexRef.current,
            correct: stats.correct,
            combo: stats.combo,
            maxCombo: stats.maxCombo,
          });
          if (soundOn) {
            if (stats.combo > 0 && stats.combo % 10 === 0) {
              playComboSound(stats.combo);
            } else {
              playCorrectSound();
            }
          }
        }
      } else {
        stats.errors += 1;
        stats.wordErrors += 1;
        stats.combo = 0;
        setGameState({ errors: stats.errors, shake: false, combo: 0 });
        if (soundOn) playErrorSound();
        requestAnimationFrame(() => setGameState({ shake: true }));
        setTimeout(() => setGameState({ shake: false }), 170);
      }
    },
    [advanceStop, runStops, typingLanguage, typingTargetMode, soundOn, setGameState],
  );

  const consumeTypingInput = useCallback(
    (input) => {
      const raw = input.value;

      // 시드 문자가 사라졌다는 건 백스페이스가 눌렸다는 뜻이다.
      if (!raw.startsWith(INPUT_SEED)) {
        input.value = INPUT_SEED;
        setGameState({ compositionText: "" });
        deleteCharacter();
        return;
      }

      const value = raw.slice(INPUT_SEED.length);
      input.value = INPUT_SEED;
      setGameState({ compositionText: "" });
      if (!value) return;

      const committed = normalizeCommittedText(value, typingLanguage, typingTargetMode);

      for (const character of committed) {
        if (typingLanguage === TYPING_LANGUAGES.KOREAN && isIncompleteJamo(character)) continue;
        typeCharacter(character);
      }
    },
    [typeCharacter, deleteCharacter, typingLanguage, typingTargetMode, setGameState],
  );

  const handleTypingInput = useCallback(
    (event) => {
      if (isComposingRef.current || event.nativeEvent?.isComposing) {
        const raw = event.currentTarget.value;
        const liveText = raw.startsWith(INPUT_SEED) ? raw.slice(INPUT_SEED.length) : raw;
        setGameState({ compositionText: liveText });
        return;
      }
      consumeTypingInput(event.currentTarget);
    },
    [consumeTypingInput, setGameState],
  );

  const handleCompositionStart = useCallback((event) => {
    isComposingRef.current = true;
    const raw = event.currentTarget.value;
    const liveText = raw.startsWith(INPUT_SEED) ? raw.slice(INPUT_SEED.length) : raw;
    setGameState({ compositionText: liveText });
  }, [setGameState]);

  const handleCompositionEnd = useCallback(
    (event) => {
      isComposingRef.current = false;
      setGameState({ compositionText: "" });
      consumeTypingInput(event.currentTarget);
    },
    [consumeTypingInput, setGameState],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      const composing = event.isComposing || event.keyCode === 229 || isComposingRef.current;

      if (event.key === "Escape") {
        if (screen === "game" && !composing) backToHome();
        return;
      }
      if (screen !== "game") return;

      if (event.key === "Backspace") {
        if (composing) {
          // 조합 중인 음절을 자모 단위로 지우게 두는 대신, 통째로 취소한다.
          event.preventDefault();
          cancelComposition();
          return;
        }
        if (event.target === typingInputRef.current) return;
        event.preventDefault();
        deleteCharacter();
        return;
      }

      if (composing) return; // 조합 중인 다른 키 입력은 IME에 맡긴다

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
  }, [backToHome, cancelComposition, deleteCharacter, screen, typeCharacter]);

  const currentTarget = runStops[stopIndex] ? getTypingTarget(runStops[stopIndex], typingLanguage, typingTargetMode) : "";

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
              aria-pressed={soundOn}
              aria-label={soundOn ? "효과음 끄기" : "효과음 켜기"}
              onClick={() => setSoundOn(!soundOn)}
            >
              {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
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
            projection={geoModel?.projection}
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