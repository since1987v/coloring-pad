import { $, toast } from './util.js';
import { getSetting, setSetting } from './store.js';
import { applyIcons, LOGO } from './icons.js';
import { initEditor, openEditor } from './editor.js';
import { initLibrary, refreshLibrary, adminAction } from './library.js';
import { initTrace } from './trace.js';
import { initMakeup, setFreeMode } from './makeup.js';
import { setRate, setMuted, setVoice, voicesFor, speak } from './speech.js';

// 홈 화면 앱으로 실행하면 이미 전체화면이라 전체화면 버튼을 숨긴다
const root = document.documentElement;
const canFs = !!(root.requestFullscreen || root.webkitRequestFullscreen);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
let fillVoices = async () => {}; // 설정 창의 목소리 목록 채우기 (initSettings에서 정함)

applyIcons();
$('#brandMark').innerHTML = LOGO;

try {
  await initEditor({ onClose: () => refreshLibrary() });
  initTrace();
  await initMakeup({ onClose: () => refreshLibrary() });
  await initLibrary({ open: (p) => openEditor(p) });
  await initSettings();
} catch (err) {
  console.error(err);
  toast('시작하지 못했어요: ' + err.message, 8000);
}

// ---------- 아이 잠금 · 설정 ----------
async function initSettings() {
  const dlg = $('#dlgSettings');
  const lock = $('#setLock');
  const rate = $('#setRate');
  const setLocked = (on) => {
    document.body.classList.toggle('locked', on);
    lock.checked = on;
    updateFsBtn();
  };
  const showRate = () => ($('#rateLabel').textContent = `${rate.value}%`);
  setLocked(await getSetting('kidLock', false));
  rate.value = Math.round((await getSetting('speechRate', 1)) * 100);
  setRate(rate.value / 100);
  showRate();

  lock.addEventListener('change', () => {
    setLocked(lock.checked);
    setSetting('kidLock', lock.checked);
    toast(lock.checked ? '아이 잠금을 켰어요' : '아이 잠금을 껐어요');
  });
  const sound = $('#setSound');
  sound.checked = await getSetting('sound', true);
  setMuted(!sound.checked);
  sound.addEventListener('change', () => {
    setMuted(!sound.checked);
    setSetting('sound', sound.checked);
  });
  // 목소리: 저장된 선택을 적용하고, 설정 창을 열 때마다 iPad에 있는 목소리 목록을 새로 채운다
  const VOICE_TEST = { ko: '안녕하세요! 기역, 기차. 참 잘했어요!', en: 'Hello! A. Apple. Great job!' };
  for (const lang of ['ko', 'en']) {
    const key = lang === 'ko' ? 'voiceKo' : 'voiceEn';
    const sel = $(lang === 'ko' ? '#setVoiceKo' : '#setVoiceEn');
    setVoice(lang, await getSetting(key, ''));
    sel.addEventListener('change', () => {
      setVoice(lang, sel.value);
      setSetting(key, sel.value);
      speak(VOICE_TEST[lang], lang);
    });
    $(lang === 'ko' ? '#testVoiceKo' : '#testVoiceEn').addEventListener('click', () => speak(VOICE_TEST[lang], lang));
  }
  fillVoices = async () => {
    for (const lang of ['ko', 'en']) {
      const sel = $(lang === 'ko' ? '#setVoiceKo' : '#setVoiceEn');
      const cur = await getSetting(lang === 'ko' ? 'voiceKo' : 'voiceEn', '');
      const list = voicesFor(lang);
      sel.replaceChildren(new Option('자동 (가장 좋은 목소리)', ''), ...list.map((v) => new Option(`${v.name}${lang === 'en' ? ` · ${v.lang}` : ''}`, v.name)));
      sel.value = list.some((v) => v.name === cur) ? cur : '';
    }
  };
  const free = $('#setFreeMakeup');
  free.checked = await getSetting('freeMakeup', false);
  setFreeMode(free.checked);
  free.addEventListener('change', () => {
    setFreeMode(free.checked);
    setSetting('freeMakeup', free.checked);
  });
  rate.addEventListener('input', () => {
    setRate(rate.value / 100);
    setSetting('speechRate', rate.value / 100);
    showRate();
  });
  dlg.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    dlg.close();
    if (act !== 'close') adminAction(act);
  });

  // 잠금 중에는 설정 버튼을 1.2초 꾹 눌러야 열린다
  const btn = $('#btnSettings');
  let timer = 0;
  const cancel = () => {
    clearTimeout(timer);
    btn.classList.remove('holding');
  };
  btn.addEventListener('pointerdown', () => {
    if (!document.body.classList.contains('locked')) return;
    btn.classList.add('holding');
    timer = setTimeout(() => {
      cancel();
      openSettings();
    }, 1200);
  });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('click', () => {
    if (document.body.classList.contains('locked')) toast('어른은 설정 버튼을 꾹 눌러 주세요');
    else openSettings();
  });
  const openSettings = async () => {
    await fillVoices();
    dlg.showModal();
  };
}

// ---------- 전체화면 ----------
function updateFsBtn() {
  const b = $('#btnFull');
  // 잠금 중 전체화면이면 아이가 빠져나가지 않게 버튼을 숨긴다
  b.hidden = !canFs || standalone || (document.body.classList.contains('locked') && isFs());
  b.classList.toggle('on', isFs());
}

$('#btnFull').addEventListener('click', () => {
  if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
});
document.addEventListener('fullscreenchange', updateFsBtn);
document.addEventListener('webkitfullscreenchange', updateFsBtn);
updateFsBtn();

// 페이지 자체가 확대되거나 당겨서 새로고침되는 것을 막는다
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
// 실수로 창을 닫거나 뒤로 가기 전에 한 번 묻는다 (브라우저 탭에서 쓸 때)
if (!standalone) window.addEventListener('beforeunload', (e) => e.preventDefault());

// 저장 공간이 부족할 때 Safari가 데이터를 지우지 않도록 요청
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
