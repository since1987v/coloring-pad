// iPad에 들어 있는 음성(한국어 유나, 영어 Samantha 등)으로 읽어 준다. 인터넷 없이도 된다.
let voices = [];
let rate = 1;

const ok = 'speechSynthesis' in window;
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
if (ok) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

let muted = false;

export const canSpeak = () => ok;
export const setRate = (r) => {
  rate = r;
};
// 설정에서 소리를 끄면 읽어주기·칭찬을 하지 않는다
export const setMuted = (m) => {
  muted = m;
  if (m && ok) speechSynthesis.cancel();
};

// 한글·숫자가 들어 있으면 한국어로 읽는다
export const langOf = (s) => (/[ㄱ-ㅎㅏ-ㅣ가-힣0-9]/.test(s) ? 'ko' : 'en');

function pickVoice(code) {
  const norm = (v) => v.lang.replace('_', '-');
  const list = voices.filter((v) => norm(v).slice(0, 2) === code.slice(0, 2));
  return (
    list.find((v) => norm(v) === code && /premium|enhanced|고급|yuna|samantha/i.test(v.name)) ||
    list.find((v) => norm(v) === code) ||
    list[0] ||
    null
  );
}

export function speak(text, lang = langOf(text), onEnd) {
  if (muted) {
    onEnd?.();
    return true;
  }
  if (!ok || !text) {
    onEnd?.();
    return false;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const code = lang === 'en' ? 'en-US' : 'ko-KR';
  u.lang = code;
  const v = pickVoice(code);
  if (v) u.voice = v;
  u.rate = (lang === 'en' ? 0.85 : 0.92) * rate;
  u.pitch = 1.1;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  speechSynthesis.speak(u);
  return true;
}

export const stopSpeaking = () => ok && speechSynthesis.cancel();
