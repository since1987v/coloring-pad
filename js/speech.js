// iPad에 들어 있는 음성(한국어 유나, 영어 Samantha 등)으로 읽어 준다. 인터넷 없이도 된다.
let voices = [];
let rate = 1;
let muted = false;
const chosen = { ko: '', en: '' }; // 설정에서 고른 목소리 이름 ('' = 자동)

const ok = 'speechSynthesis' in window;
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
if (ok) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export const canSpeak = () => ok;
export const setRate = (r) => {
  rate = r;
};
// 설정에서 소리를 끄면 읽어주기·칭찬을 하지 않는다
export const setMuted = (m) => {
  muted = m;
  if (m && ok) speechSynthesis.cancel();
};
export const setVoice = (lang, name) => {
  chosen[lang] = name || '';
};

// 한글·숫자가 들어 있으면 한국어로 읽는다
export const langOf = (s) => (/[ㄱ-ㅎㅏ-ㅣ가-힣0-9]/.test(s) ? 'ko' : 'en');

const norm = (v) => v.lang.replace('_', '-');

// 여자 선생님 같은 또렷한 목소리를 먼저 고른다: 고급(Premium) > 향상됨(Enhanced) > 기본, 여성 목소리 우선
const FEMALE = /yuna|유나|sora|소라|suhyun|수현|seoyeon|서연|jiyoung|samantha|ava|allison|susan|karen|serena|zoe|nicky|siri.*(female|여성)/i;
const MALE = /minsu|민수|jian|지안|daniel|alex|fred|tom|aaron|arthur|male|남성/i;
function rank(v) {
  let s = 0;
  if (/premium|고급/i.test(v.name)) s += 40;
  else if (/enhanced|향상/i.test(v.name)) s += 25;
  if (FEMALE.test(v.name)) s += 10;
  if (MALE.test(v.name)) s -= 15;
  if (v.localService) s += 2;
  return s;
}

export function voicesFor(lang) {
  if (!ok) return [];
  loadVoices();
  const code = lang === 'en' ? 'en' : 'ko';
  return voices.filter((v) => norm(v).toLowerCase().startsWith(code)).sort((a, b) => rank(b) - rank(a));
}

function pickVoice(lang) {
  const list = voicesFor(lang);
  if (chosen[lang]) {
    const v = list.find((x) => x.name === chosen[lang]);
    if (v) return v;
  }
  // 영어는 미국 발음 우선
  if (lang === 'en') return list.find((v) => norm(v) === 'en-US') || list[0] || null;
  return list[0] || null;
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
  u.lang = lang === 'en' ? 'en-US' : 'ko-KR';
  const v = pickVoice(lang);
  if (v) u.voice = v;
  // 음높이를 올리면 소리가 뭉개지므로 기본 그대로, 속도만 살짝 느리게
  u.rate = (lang === 'en' ? 0.85 : 0.95) * rate;
  u.pitch = 1;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  speechSynthesis.speak(u);
  return true;
}

export const stopSpeaking = () => ok && speechSynthesis.cancel();
