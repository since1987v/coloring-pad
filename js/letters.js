import { toast } from './util.js';
import { getSetting, setSetting } from './store.js';
import { ICON } from './icons.js';
import { langOf } from './speech.js';
import { loadStars, starsOf } from './progress.js';
import { openTrace } from './trace.js';

// [글자, 이름, 예시 낱말, 그림]
const CONS = [
  ['ㄱ', '기역', '기차', '🚂'], ['ㄴ', '니은', '나비', '🦋'], ['ㄷ', '디귿', '도토리', '🌰'], ['ㄹ', '리을', '라면', '🍜'],
  ['ㅁ', '미음', '무지개', '🌈'], ['ㅂ', '비읍', '바나나', '🍌'], ['ㅅ', '시옷', '사과', '🍎'], ['ㅇ', '이응', '오리', '🦆'],
  ['ㅈ', '지읒', '자동차', '🚗'], ['ㅊ', '치읓', '치즈', '🧀'], ['ㅋ', '키읔', '코끼리', '🐘'], ['ㅌ', '티읕', '토끼', '🐰'],
  ['ㅍ', '피읖', '포도', '🍇'], ['ㅎ', '히읗', '하마', '🦛'],
];
const VOW = [
  ['ㅏ', '아', '아기', '👶'], ['ㅑ', '야', '야구', '⚾'], ['ㅓ', '어', '어부', '🎣'], ['ㅕ', '여', '여우', '🦊'],
  ['ㅗ', '오', '오이', '🥒'], ['ㅛ', '요', '요요', '🪀'], ['ㅜ', '우', '우유', '🥛'], ['ㅠ', '유', '유령', '👻'],
  ['ㅡ', '으', '크레파스', '🖍️'], ['ㅣ', '이', '이빨', '🦷'],
];
const ALPHA = [
  ['A', 'apple', '🍎'], ['B', 'ball', '⚽'], ['C', 'cat', '🐱'], ['D', 'dog', '🐶'], ['E', 'egg', '🥚'], ['F', 'fish', '🐟'],
  ['G', 'grape', '🍇'], ['H', 'hat', '🎩'], ['I', 'ice cream', '🍦'], ['J', 'juice', '🧃'], ['K', 'kite', '🪁'], ['L', 'lion', '🦁'],
  ['M', 'moon', '🌙'], ['N', 'nest', '🪺'], ['O', 'orange', '🍊'], ['P', 'pig', '🐷'], ['Q', 'queen', '👑'], ['R', 'rabbit', '🐰'],
  ['S', 'sun', '☀️'], ['T', 'tree', '🌳'], ['U', 'umbrella', '☂️'], ['V', 'violin', '🎻'], ['W', 'whale', '🐳'], ['X', 'fox', '🦊'],
  ['Y', 'yo-yo', '🪀'], ['Z', 'zebra', '🦓'],
];
const NUMS = [
  ['1', '일', '하나'], ['2', '이', '둘'], ['3', '삼', '셋'], ['4', '사', '넷'], ['5', '오', '다섯'],
  ['6', '육', '여섯'], ['7', '칠', '일곱'], ['8', '팔', '여덟'], ['9', '구', '아홉'], ['10', '십', '열'],
];
const KO_WORDS = [
  ['나무', '🌳'], ['사과', '🍎'], ['바나나', '🍌'], ['기차', '🚂'], ['우유', '🥛'], ['엄마', '👩'], ['아빠', '👨'], ['오리', '🦆'],
  ['하마', '🦛'], ['포도', '🍇'], ['토끼', '🐰'], ['나비', '🦋'], ['구름', '☁️'], ['바다', '🌊'], ['모자', '🧢'], ['사자', '🦁'],
  ['고양이', '🐱'], ['강아지', '🐶'], ['비행기', '✈️'], ['딸기', '🍓'],
];
const EN_WORDS = [
  ['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['apple', '🍎'], ['ball', '⚽'], ['fish', '🐟'], ['bird', '🐦'], ['star', '⭐'],
  ['moon', '🌙'], ['tree', '🌳'], ['book', '📖'], ['cake', '🍰'], ['frog', '🐸'], ['duck', '🦆'], ['milk', '🥛'], ['bus', '🚌'],
];
const keycap = (n) => (n === 10 ? '🔟' : `${n}️⃣`);

export const DECKS = [
  { id: 'ko-cons', title: '한글 자음', glyphs: 'ㄱㄴㄷ', bg: '#FFE9DF', ink: '#FF6A4D', lang: 'ko',
    items: CONS.map(([t, name, ex, em]) => ({ t, name, ex, em, say: `${name}. ${ex}` })) },
  { id: 'ko-vow', title: '한글 모음', glyphs: 'ㅏㅑㅓ', bg: '#FFF3CF', ink: '#E09B00', lang: 'ko',
    items: VOW.map(([t, name, ex, em]) => ({ t, name, ex, em, say: `${name}. ${ex}` })) },
  { id: 'en-upper', title: '알파벳 대문자', glyphs: 'ABC', bg: '#E3EFFF', ink: '#2F7BE0', lang: 'en',
    items: ALPHA.map(([L, ex, em]) => ({ t: L, name: L, ex, em, say: `${L}. ${ex}.` })) },
  { id: 'en-lower', title: '알파벳 소문자', glyphs: 'abc', bg: '#E2F6EC', ink: '#259B70', lang: 'en',
    items: ALPHA.map(([L, ex, em]) => ({ t: L.toLowerCase(), name: L.toLowerCase(), ex, em, say: `${L}. ${ex}.` })) },
  { id: 'num', title: '숫자', glyphs: '123', bg: '#EFE8FF', ink: '#7E57C2', lang: 'ko',
    items: NUMS.map(([t, name, ex], i) => ({ t, name, ex, em: keycap(i + 1), say: `${name}. ${ex}` })) },
  { id: 'ko-words', title: '한글 낱말', glyphs: '나무', bg: '#FFE6F0', ink: '#E0457B', lang: 'ko', word: true,
    items: KO_WORDS.map(([t, em]) => ({ t, em, ex: t, say: t })) },
  { id: 'en-words', title: '영어 낱말', glyphs: 'cat', bg: '#DFF4F8', ink: '#139BB5', lang: 'en', word: true,
    items: EN_WORDS.map(([t, em]) => ({ t, em, ex: t, say: t })) },
  { id: 'custom', title: '내 단어', glyphs: '가A', bg: '#EFEAE2', ink: '#6F675F', word: true, custom: true, items: [] },
];

let openDeck = null;
let container = null;
let customWords = null;

async function loadCustom() {
  if (!customWords) customWords = await getSetting('customWords', []);
  DECKS.find((d) => d.custom).items = customWords.map((t) => ({ t, em: '', ex: t, say: t, lang: langOf(t) }));
}

export async function renderLetters(el) {
  container = el;
  await Promise.all([loadStars(), loadCustom()]);
  if (openDeck) renderDeck(openDeck);
  else renderDecks();
}

const keyOf = (deck, item) => `${deck.id}:${item.t}`;
const deckStars = (d) => d.items.reduce((s, it) => s + starsOf(keyOf(d, it)), 0);
const starRow = (n) => [1, 2, 3].map((i) => ICON.star.replace('<svg', `<svg class="${i <= n ? 'on' : ''}"`)).join('');

function renderDecks() {
  container.innerHTML = `<div class="deck-grid">${DECKS.map(
    (d, i) => `<button class="deck" data-deck="${d.id}" style="--deck-bg:${d.bg};--deck-ink:${d.ink};animation-delay:${i * 30}ms">
      <span class="glyphs ${d.lang === 'en' ? 'en' : ''}">${d.glyphs}</span>
      <span><span class="t">${d.title}</span><span class="s">${d.custom && !d.items.length ? '아이 이름이나 좋아하는 낱말' : `${d.items.length}개 · ${ICON.star}${deckStars(d)} / ${d.items.length * 3}`}</span></span>
    </button>`,
  ).join('')}</div>`;
  container.querySelector('.deck-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.deck');
    if (!b) return;
    openDeck = DECKS.find((d) => d.id === b.dataset.deck);
    renderDeck(openDeck);
  });
}

function renderDeck(d) {
  const tiles = d.items
    .map(
      (it, i) => `<button class="ltile" data-i="${i}" style="animation-delay:${Math.min(i, 20) * 15}ms">
        ${d.word && it.em ? `<span class="em">${it.em}</span>` : ''}
        <span class="g ${(it.lang || d.lang) === 'en' ? 'en' : ''}" style="color:${d.ink}"></span>
        ${it.name && !d.word ? `<span class="n"></span>` : ''}
        <span class="st">${starRow(starsOf(keyOf(d, it)))}</span>
        ${d.custom ? `<span class="x admin" data-del="${i}" role="button" aria-label="지우기">${ICON.close}</span>` : ''}
      </button>`,
    )
    .join('');
  const add = d.custom ? `<button class="ltile add admin" data-add="1">${ICON.plus}<span>낱말 넣기</span></button>` : '';
  container.innerHTML = `
    <div class="deck-head">
      <button class="circle" data-back="1" aria-label="뒤로">${ICON.back}</button>
      <h2></h2><span class="s">${ICON.star.replace('<svg', '<svg style="width:16px;height:16px;display:inline;color:#f5b400;vertical-align:-2px"')} ${deckStars(d)} / ${d.items.length * 3}</span>
    </div>
    <div class="letter-grid ${d.word ? 'words' : ''}">${tiles}${add}</div>`;
  container.querySelector('h2').textContent = d.title;
  // 사용자가 넣은 낱말이 HTML로 해석되지 않도록 글자는 textContent로 넣는다
  container.querySelectorAll('.ltile[data-i]').forEach((b) => {
    const it = d.items[+b.dataset.i];
    b.querySelector('.g').textContent = it.t;
    const n = b.querySelector('.n');
    if (n) n.textContent = it.name;
  });
  container.querySelector('.deck-head').addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) {
      openDeck = null;
      renderDecks();
    }
  });
  container.querySelector('.letter-grid').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const t = customWords[+del.dataset.del];
      if (!confirm(`'${t}'를 지울까요?`)) return;
      customWords.splice(+del.dataset.del, 1);
      await saveCustom();
      return;
    }
    if (e.target.closest('[data-add]')) {
      const t = prompt('따라 쓸 낱말을 넣어 주세요 (한글 또는 영어, 16글자까지 · 길면 여러 줄로 나눠져요)')?.trim();
      if (!t) return;
      if ([...t].length > 16) {
        toast('16글자까지 넣을 수 있어요');
        return;
      }
      customWords.push(t);
      await saveCustom();
      return;
    }
    const b = e.target.closest('.ltile[data-i]');
    if (b) openTrace(d, +b.dataset.i, { keyOf, onClose: () => renderLetters(container) });
  });
}

async function saveCustom() {
  await setSetting('customWords', customWords);
  await loadCustom();
  renderDeck(openDeck);
}
