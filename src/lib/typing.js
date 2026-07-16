export const TYPING_LANGUAGES = {
  ENGLISH: "en",
  KOREAN: "ko",
};

const NON_WORD_CHARACTERS = /[^\p{Letter}\p{Number}]/gu;

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

export function getTypingTarget(stop, language) {
  if (!stop) return "";
  if (language === TYPING_LANGUAGES.KOREAN) {
    return (stop.name_ko ?? "").normalize("NFKC").replace(NON_WORD_CHARACTERS, "");
  }
  return (stop.name_en ?? "").normalize("NFKC").toLowerCase();
}

export function normalizeCommittedText(value, language) {
  const normalized = value.normalize("NFKC");
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
