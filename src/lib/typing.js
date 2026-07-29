export const TYPING_LANGUAGES = {
  ENGLISH: "en",
  KOREAN: "ko",
};

export const TYPING_MODES = {
  WORD: "word",
  SENTENCE: "sentence",
};

const NON_WORD_CHARACTERS = /[^\p{Letter}\p{Number}]/gu;

// Hangul Jamo constants for decomposition & live matching
const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

export function decomposeHangulChar(char) {
  if (!char) return null;
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) {
    return { cho: char, jung: '', jong: '', raw: char };
  }
  const diff = code - 0xAC00;
  const choIdx = Math.floor(diff / 588);
  const jungIdx = Math.floor((diff % 588) / 28);
  const jongIdx = diff % 28;
  return {
    cho: CHO[choIdx],
    jung: JUNG[jungIdx],
    jong: JONG[jongIdx],
    raw: char,
  };
}

export function isCompositionPartialMatch(compositionText, targetChar) {
  if (!compositionText || !targetChar) return false;
  const compDec = decomposeHangulChar(compositionText);
  const targetDec = decomposeHangulChar(targetChar);
  if (!compDec || !targetDec) return false;

  // Compare initial consonant
  if (compDec.cho && compDec.cho === targetDec.cho) {
    return true;
  }
  return false;
}

// 유연한 오타 매칭을 위한 사전 (외래어 표기 시 흔히 헷갈리는 모음/자음)
const FLEXIBLE_MATCHES = {
  '쾨': ['코', '케', '쾌'],
  '르': ['루', '러'],
  '몽': ['몬'],
  '트': ['투', '터', '티'],
  '마': ['머'],
  '파': ['빠', '바'],
  '세': ['쎄', '셰', '새'],
  '셰': ['세', '쉐'],
  '베': ['배', '빼'],
  '레': ['래'],
  '네': ['내'],
  '메': ['매'],
  '페': ['패'],
  '체': ['채'],
  '제': ['재'],
  '데': ['대'],
  '게': ['개'],
  '에': ['애'],
  '새': ['세'],
  '프': ['푸', '퍼'],
  '스': ['쑤', '슈'],
  '크': ['쿠', '커'],
  '츠': ['추', '처'],
};

export function getTypingTarget(stop, language, mode = TYPING_MODES.WORD) {
  if (!stop) return "";
  if (mode === TYPING_MODES.SENTENCE && stop.description) {
    return stop.description.normalize("NFKC");
  }
  if (language === TYPING_LANGUAGES.KOREAN) {
    return (stop.name_ko ?? "").normalize("NFKC").replace(NON_WORD_CHARACTERS, "");
  }
  return (stop.name_en ?? "").normalize("NFKC").toLowerCase();
}

export function normalizeCommittedText(value, language, mode = TYPING_MODES.WORD) {
  const normalized = value.normalize("NFKC");
  if (mode === TYPING_MODES.SENTENCE) {
    return normalized;
  }
  return language === TYPING_LANGUAGES.KOREAN
    ? normalized.replace(NON_WORD_CHARACTERS, "")
    : normalized;
}

export function isTypingCharacterMatch(typed, expected, language) {
  if (!typed || !expected) return false;
  
  if (language === TYPING_LANGUAGES.KOREAN) {
    const normTyped = typed.normalize("NFKC");
    if (normTyped === expected) return true;
    
    // 유연한 오타 허용 로직
    if (FLEXIBLE_MATCHES[expected] && FLEXIBLE_MATCHES[expected].includes(normTyped)) {
      return true;
    }
    return false;
  }
  
  return typed.toLowerCase() === expected.toLowerCase();
}

// 한글 완성형 음절(가-힣)이 아니라 자음/모음 낱자 하나만 있는 경우를 판별한다.
const HANGUL_JAMO_ONLY = /^[\u3131-\u318E]$/;

export function isIncompleteJamo(character) {
  return HANGUL_JAMO_ONLY.test(character);
}