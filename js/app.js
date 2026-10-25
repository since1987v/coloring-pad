import { $, toast } from './util.js';
import { getSetting, setSetting } from './store.js';
import { applyIcons, LOGO } from './icons.js';
import { initEditor, openEditor } from './editor.js';
import { initLibrary, refreshLibrary, adminAction } from './library.js';
import { initTrace } from './trace.js';
import { initMakeup, setFreeMode } from './makeup.js';
import { setRate, setMuted } from './speech.js';

// 홈 화면 앱으로 실행하면 이미 전체화면이라 전체화면 버튼을 숨긴다
const root = document.documentElement;
const canFs = !!(root.requestFullscreen || root.webkitRequestFullscreen);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

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
      dlg.showModal();
    }, 1200);
  });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('click', () => {
    if (document.body.classList.contains('locked')) toast('어른은 설정 버튼을 꾹 눌러 주세요');
    else dlg.showModal();
  });
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
