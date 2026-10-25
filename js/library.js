import { $, $$, toast, uid, loadImage, drawFit, toBlob, thumbBlob, cleanLineArt, looksLikePhoto, photoToSketch, freeCanvas, shareOrDownload, pickFile, makeCanvas } from './util.js';
import { db, getFile, putFile, delFile, deletePicture, getSetting, setSetting } from './store.js';
import { ICON } from './icons.js';
import { renderLetters } from './letters.js';
import { renderMakeupHome, MK_LAYERS, allFaces, customFaces } from './makeup.js';
import { loadStars } from './progress.js';

const WORK_MAX = 2048; // 도안은 긴 변 2048px로 맞춰 저장 (작은 그림도 키워서 붓 질감이 곱게 나오게)
const SAMPLE_MAX = 1600;
// 파일 이름 끝이 이렇게 끝나면 샘플(색칠본)로 본다: 고양이_sample.png, 고양이-색칠.jpg …
const SAMPLE_RE = /[\s._-]*(sample|samples|color|colored|colour|coloured|샘플|색칠|색칠본|완성|컬러)$/i;
// 카드 아래 이름 띠 색 (카테고리마다 같은 색)
const BANDS = ['#FFE3EF', '#FFF1D0', '#E3F2FF', '#E2F7EC', '#EFE8FF', '#FFE6DC'];
const collator = new Intl.Collator('ko', { numeric: true });

let pictures = [];
let state = { mode: 'color', view: 'line', cat: '__all', sort: 'new', q: '' };
let openEditor = () => {};
let blobUrls = new Map();
let galleryUrls = [];
let editing = null;

function burl(b) {
  let u = blobUrls.get(b);
  if (!u) {
    u = URL.createObjectURL(b);
    blobUrls.set(b, u);
  }
  return u;
}

async function reload() {
  for (const u of blobUrls.values()) URL.revokeObjectURL(u);
  blobUrls = new Map();
  pictures = await db.all('pictures');
}

export async function initLibrary(opts) {
  openEditor = opts.open;
  const saved = await getSetting('libState', {});
  // 앱은 언제나 색칠하기 화면에서 시작한다
  state = { ...state, ...saved, mode: 'color', q: '' };
  if (state.view === 'gallery') state.view = 'line';
  bind();
  await reload();
  render();
}

export async function refreshLibrary() {
  await reload();
  render();
  // 관리 화면이 열려 있으면 같이 새로 그린다
  document.dispatchEvent(new Event('library-changed'));
}

// ---------- 관리 화면에서 쓰는 것 ----------
export const listPictures = () => pictures;

export async function removePicture(p) {
  if (!confirm(`'${p.title}' 그림을 지울까요?\n(색칠한 것도 같이 지워져요. 내 작품에 건 것은 남아요)`)) return false;
  await deletePicture(p.id);
  await refreshLibrary();
  toast('그림을 지웠어요');
  return true;
}

const saveState = () => setSetting('libState', { view: state.view, cat: state.cat, sort: state.sort });

function go(mode) {
  state.mode = mode;
  render();
}

function bind() {
  let qTimer = 0;
  $('.side').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) go(b.dataset.mode);
  });
  $('#search').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      state.q = e.target.value;
      if (state.q && state.mode !== 'color') state.mode = 'color';
      render();
    }, 150);
  });
  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    saveState();
    render();
  });
  $('#viewSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.view = b.dataset.view;
    saveState();
    render();
  });
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state.cat = b.dataset.cat;
    saveState();
    render();
  });
  $('#grid').addEventListener('click', onGridClick);
  $('#galleryGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) openArt(card.dataset.art);
  });
  $('#empty').addEventListener('click', (e) => {
    if (e.target.closest('[data-act=add]')) openAdd();
    if (e.target.closest('[data-act=blank]')) createBlank();
    if (e.target.closest('[data-act=help]')) showHelp();
  });
  $('#addGo').addEventListener('click', doAdd);
  $('#addCancel').addEventListener('click', () => $('#dlgAdd').close());
  $('#dlgEdit').addEventListener('click', onEditClick);
  $('#dlgHelp').addEventListener('click', (e) => e.target.closest('[data-act=close]') && $('#dlgHelp').close());
  $('#dlgArt').addEventListener('click', onArtClick);
}

// ---------- 화면 ----------
const TITLES = { color: '어떤 그림을 칠할까?', letters: '어떤 글자를 써 볼까?', makeup: '누구를 꾸며 볼까?', gallery: '내 작품 전시회' };

function render() {
  $$('.side .mode-btn').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
  $('#secTitle').textContent = TITLES[state.mode];
  const color = state.mode === 'color';
  $('#colorTools').hidden = !color;
  $('#searchBox').hidden = !color;
  $('#paneColor').hidden = !color;
  $('#paneLetters').hidden = state.mode !== 'letters';
  $('#paneMakeup').hidden = state.mode !== 'makeup';
  $('#paneGallery').hidden = state.mode !== 'gallery';
  if (state.mode === 'letters') renderLetters($('#paneLetters'));
  else if (state.mode === 'makeup') renderMakeupHome($('#paneMakeup'));
  else if (state.mode === 'gallery') renderGallery();
  else renderColor();
  renderSide();
}

// 왼쪽 큰 버튼 아래 작은 글씨 (그림 수 · 별 수 · 작품 수)
async function renderSide() {
  const week = Date.now() - 7 * 86400000;
  const fresh = pictures.filter((p) => p.createdAt > week && !p.blank).length;
  $('#subColor').textContent = `그림 ${pictures.filter((p) => !p.blank).length}장`;
  $('#newBadge').hidden = !fresh;
  $('#newBadge').textContent = `NEW ${fresh}`;
  const stars = Object.values(await loadStars()).reduce((s, n) => s + n, 0);
  $('#subLetters').textContent = stars ? `별 ${stars}개 모았어요` : '듣고 따라 써요';
  const arts = (await db.all('gallery')).length;
  $('#subGallery').textContent = arts ? `작품 ${arts}개` : '전시회';
}

function tile(act, label, icon, cls = '') {
  const b = document.createElement('button');
  b.className = `card tile ${cls}`;
  b.dataset.act = act;
  b.innerHTML = `<span class="ic">${icon}</span>${label}`;
  return b;
}

// 흰 도화지: 하얀 '도안'을 가진 그림으로 만들어 두면 색칠 화면의 모든 기능을 그대로 쓸 수 있다
async function createBlank() {
  const [w, h] = window.innerWidth > window.innerHeight ? [2048, 1536] : [1536, 2048];
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, w, h);
  const n = pictures.filter((p) => p.blank).length + 1;
  const meta = {
    id: uid('p'), title: `도화지 ${n}`, category: '도화지', tags: [], favorite: false, createdAt: Date.now(), coloredAt: 0,
    w, h, lineThumb: await thumbBlob(c), sampleThumb: null, colorThumb: null, hasSample: false, blank: true,
  };
  await putFile(meta.id, 'line', await toBlob(c));
  freeCanvas(c);
  await db.put('pictures', meta);
  pictures.push(meta);
  openEditor(meta);
}

function renderColor() {
  $$('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
  $('#sort').value = state.sort;
  renderChips();
  const list = sortList(filterList(pictures));
  const browsing = state.cat === '__all' && !state.q;
  $('#grid').replaceChildren(
    ...(browsing ? [tile('blank', '흰 도화지', ICON.paper, 'paper')] : []),
    ...list.map((p, i) => cardEl(p, i)),
    ...(browsing && !document.body.classList.contains('locked') ? [tile('add', '새 그림 넣기', ICON.plus)] : []),
  );
  if (!pictures.length) showEmpty(EMPTY_HTML);
  else showEmpty(list.length ? '' : '<p class="center muted">찾는 그림이 없어요</p>');
}

function showEmpty(html) {
  $('#empty').hidden = !html;
  $('#grid').hidden = !!html;
  $('#empty').innerHTML = html;
}

function filterList(list) {
  let out = list;
  if (state.cat === '__fav') out = out.filter((p) => p.favorite);
  else if (state.cat === '__none') out = out.filter((p) => !p.category);
  else if (state.cat !== '__all') out = out.filter((p) => p.category === state.cat);
  const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length) {
    out = out.filter((p) => {
      const hay = `${p.title} ${p.category || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  return out;
}

const SORTS = {
  new: (a, b) => b.createdAt - a.createdAt,
  old: (a, b) => a.createdAt - b.createdAt,
  name: (a, b) => collator.compare(a.title, b.title),
  colored: (a, b) => (b.coloredAt || 0) - (a.coloredAt || 0) || b.createdAt - a.createdAt,
  fav: (a, b) => b.favorite - a.favorite || b.createdAt - a.createdAt,
};
const sortList = (list) => [...list].sort(SORTS[state.sort] || SORTS.new);

function renderChips() {
  const counts = new Map();
  let none = 0;
  let fav = 0;
  for (const p of pictures) {
    if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1);
    else none++;
    if (p.favorite) fav++;
  }
  const cats = [...counts.keys()].sort(collator.compare);
  if (!['__all', '__fav', '__none', ...cats].includes(state.cat)) state.cat = '__all';
  const chips = [['__all', '전체', pictures.length], ['__fav', '좋아요', fav]];
  cats.forEach((c) => chips.push([c, c, counts.get(c)]));
  if (none) chips.push(['__none', '미분류', none]);
  $('#chips').replaceChildren(
    ...chips.map(([k, label, n]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (k === state.cat ? ' on' : '');
      b.dataset.cat = k;
      const em = document.createElement('em');
      em.textContent = n;
      b.append(label, em);
      return b;
    }),
  );
}

function cardEl(p, i) {
  const a = document.createElement('article');
  a.className = 'card';
  a.style.animationDelay = Math.min(i, 12) * 25 + 'ms';
  a.dataset.id = p.id;
  let thumb = p.lineThumb;
  let ribbon = '';
  if (state.view === 'sample') {
    if (p.sampleThumb) thumb = p.sampleThumb;
    else ribbon = '샘플 없음';
  } else if (state.view === 'color') {
    if (p.colorThumb) thumb = p.colorThumb;
    else ribbon = '아직 안 칠했어요';
  }
  // 흰 도화지는 하얀 도안 대신 그린 그림을 보여 준다
  if (p.blank && p.colorThumb) thumb = p.colorThumb;
  const badge = state.view === 'line' && p.colorThumb && !p.blank ? '<span class="sticker sky">칠하는 중</span>' : '';
  let h = 0;
  for (const ch of p.category || '') h = (h * 31 + ch.charCodeAt(0)) | 0;
  a.style.setProperty('--band', BANDS[Math.abs(h) % BANDS.length]);
  a.innerHTML = `
    <div class="thumb"><img alt="" src="${burl(thumb)}">${badge}${ribbon ? `<span class="ribbon">${ribbon}</span>` : ''}</div>
    <button class="fav ${p.favorite ? 'on' : ''}" data-act="fav" aria-label="좋아요">${ICON.heart}</button>
    <div class="band"><div><div class="title"></div><div class="sub"></div></div></div>`;
  a.querySelector('.title').textContent = p.title;
  a.querySelector('.sub').textContent = [p.category || '미분류', ...(p.tags || []).map((t) => '#' + t)].join('  ');
  // 미리보기 주소가 그사이 바뀌어 못 불러오면 새 주소로 한 번 더 불러온다
  const img = a.querySelector('img');
  img.onerror = () => {
    if (img.dataset.retried) return;
    img.dataset.retried = '1';
    img.src = URL.createObjectURL(thumb);
  };
  return a;
}

async function onGridClick(e) {
  const t = e.target.closest('.tile')?.dataset.act;
  if (t === 'blank') return createBlank();
  if (t === 'add') return openAdd();
  const card = e.target.closest('.card');
  if (!card) return;
  const p = pictures.find((x) => x.id === card.dataset.id);
  if (!p) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'fav') {
    p.favorite = !p.favorite;
    await db.put('pictures', p);
    render();
  } else if (act === 'edit') openEdit(p);
  else openEditor(p);
}

// ---------- 등록 ----------
const baseName = (n) => n.replace(/\.[^.]+$/, '');
const keyName = (n) => baseName(n).replace(SAMPLE_RE, '').trim().toLowerCase();
const prettyName = (n) => baseName(n).replace(SAMPLE_RE, '').replace(/_+/g, ' ').trim() || '이름 없는 그림';
const parseTags = (s) => [...new Set(s.split(/[,，#]/).map((t) => t.trim()).filter(Boolean))];

function fillCatList() {
  const cats = [...new Set(pictures.map((p) => p.category).filter(Boolean))].sort(collator.compare);
  $('#catList').innerHTML = cats.map((c) => `<option value="${c.replace(/"/g, '&quot;')}">`).join('');
}

export function openAdd() {
  $('#formAdd').reset();
  $('#addProgress').textContent = '';
  fillCatList();
  if (!state.cat.startsWith('__')) $('#addCat').value = state.cat;
  $('#dlgAdd').showModal();
}

async function doAdd() {
  let lines = [...$('#addLine').files];
  let samples = [...$('#addSample').files];
  // 도안 칸에 샘플 파일까지 한꺼번에 골랐으면 이름으로 골라낸다
  if (lines.length > 1) {
    const moved = lines.filter((f) => SAMPLE_RE.test(baseName(f.name)));
    if (moved.length) {
      lines = lines.filter((f) => !moved.includes(f));
      samples = [...samples, ...moved];
    }
  }
  if (!lines.length) {
    toast('도안 그림을 골라 주세요');
    return;
  }
  const category = $('#addCat').value.trim();
  const tags = parseTags($('#addTags').value);
  const clean = $('#addClean').checked;
  const photo = $('#addPhoto').checked;
  const title1 = $('#addTitle').value.trim();
  const sampleByKey = new Map(samples.map((f) => [keyName(f.name), f]));
  const go = $('#addGo');
  go.disabled = true;
  let ok = 0;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i];
    $('#addProgress').textContent = `${i + 1} / ${lines.length} 등록 중…`;
    const sample = lines.length === 1 && samples.length === 1 ? samples[0] : sampleByKey.get(keyName(f.name));
    try {
      await importPicture({ file: f, sample, title: (lines.length === 1 && title1) || prettyName(f.name), category, tags, clean, photo });
      ok++;
    } catch (err) {
      console.error(err);
      toast(`${f.name}: ${err.message}`);
    }
  }
  go.disabled = false;
  $('#dlgAdd').close();
  if (ok) toast(`${ok}장 등록했어요`);
  await refreshLibrary();
}

// photo: 사진처럼 명암이 많은 그림이면 연한 스케치로 바꿔서, 칠할 칸이 진한 음영에 묻히지 않게 한다
async function processLine(file, clean, photo = true) {
  const img = await loadImage(file);
  const c = drawFit(img, WORK_MAX, '#fff', true);
  if (photo && looksLikePhoto(c)) photoToSketch(c);
  else if (clean) cleanLineArt(c);
  try {
    return { blob: await toBlob(c), thumb: await thumbBlob(c), w: c.width, h: c.height };
  } finally {
    freeCanvas(c);
  }
}

async function attachSample(meta, file) {
  const img = await loadImage(file);
  const c = drawFit(img, SAMPLE_MAX, '#fff');
  try {
    await putFile(meta.id, 'sample', await toBlob(c, 'image/jpeg', 0.9));
    meta.sampleThumb = await thumbBlob(c);
    meta.hasSample = true;
  } finally {
    freeCanvas(c);
  }
}

async function importPicture({ file, sample, title, category, tags, clean, photo }) {
  const line = await processLine(file, clean, photo);
  const meta = {
    id: uid('p'), title, category, tags, favorite: false, createdAt: Date.now(), coloredAt: 0,
    w: line.w, h: line.h, lineThumb: line.thumb, sampleThumb: null, colorThumb: null, hasSample: false,
  };
  await putFile(meta.id, 'line', line.blob);
  if (sample) await attachSample(meta, sample);
  await db.put('pictures', meta);
}

// ---------- 정보 수정 ----------
export function openEdit(p) {
  editing = p;
  fillCatList();
  $('#editTitle').value = p.title;
  $('#editCat').value = p.category || '';
  $('#editTags').value = (p.tags || []).join(', ');
  $('#editFav').checked = !!p.favorite;
  renderEditPreview();
  $('#dlgEdit').showModal();
}

function renderEditPreview() {
  const p = editing;
  $('#editLineImg').src = burl(p.lineThumb);
  const s = $('#editSampleImg');
  if (p.sampleThumb) s.src = burl(p.sampleThumb);
  else s.removeAttribute('src');
  $('#editSampleBox').classList.toggle('none', !p.sampleThumb);
  $('#dlgEdit [data-act=removeSample]').hidden = !p.hasSample;
}

async function onEditClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const p = editing;
  if (!act || !p) return;
  const dlg = $('#dlgEdit');
  try {
    if (act === 'close') dlg.close();
    else if (act === 'save') {
      p.title = $('#editTitle').value.trim() || p.title;
      p.category = $('#editCat').value.trim();
      p.tags = parseTags($('#editTags').value);
      p.favorite = $('#editFav').checked;
      await db.put('pictures', p);
      dlg.close();
      await refreshLibrary();
    } else if (act === 'replaceLine') {
      const f = await pickFile($('#fileLine'));
      if (!f) return;
      if (p.colorThumb && !confirm('도안을 바꾸면 색칠한 것은 지워져요. 바꿀까요?')) return;
      const line = await processLine(f, true);
      await putFile(p.id, 'line', line.blob);
      await delFile(p.id, 'paint');
      Object.assign(p, { lineThumb: line.thumb, w: line.w, h: line.h, colorThumb: null, coloredAt: 0 });
      await db.put('pictures', p);
      renderEditPreview();
      toast('도안을 바꿨어요');
    } else if (act === 'setSample') {
      const f = await pickFile($('#fileSample'));
      if (!f) return;
      await attachSample(p, f);
      await db.put('pictures', p);
      renderEditPreview();
      toast('샘플을 등록했어요');
    } else if (act === 'removeSample') {
      await delFile(p.id, 'sample');
      Object.assign(p, { sampleThumb: null, hasSample: false });
      await db.put('pictures', p);
      renderEditPreview();
    } else if (act === 'resetColor') {
      if (!confirm('이 그림에 색칠한 것을 모두 지울까요?')) return;
      await delFile(p.id, 'paint');
      Object.assign(p, { colorThumb: null, coloredAt: 0 });
      await db.put('pictures', p);
      toast('색칠을 지웠어요');
    } else if (act === 'delete') {
      if (!confirm(`'${p.title}' 그림을 삭제할까요?\n(내 작품에 건 것은 남아요)`)) return;
      await deletePicture(p.id);
      dlg.close();
      await refreshLibrary();
    }
  } catch (err) {
    console.error(err);
    toast('실패했어요: ' + err.message);
  }
}

// ---------- 내 작품 ----------
async function renderGallery() {
  for (const u of galleryUrls) URL.revokeObjectURL(u);
  galleryUrls = [];
  const arts = (await db.all('gallery')).sort((a, b) => b.createdAt - a.createdAt);
  if (state.mode !== 'gallery') return;
  $('#galleryGrid').replaceChildren(
    ...arts.map((a, i) => {
      const el = document.createElement('article');
      el.className = 'card';
      el.style.animationDelay = Math.min(i, 12) * 25 + 'ms';
      el.dataset.art = a.id;
      const u = URL.createObjectURL(a.thumb);
      galleryUrls.push(u);
      el.style.setProperty('--band', BANDS[i % BANDS.length]);
      el.innerHTML = `<div class="thumb"><img alt="" src="${u}"></div><div class="band"><div><div class="title"></div><div class="sub">${new Date(a.createdAt).toLocaleDateString('ko-KR')}</div></div></div>`;
      el.querySelector('.title').textContent = a.title;
      return el;
    }),
  );
  $('#galleryGrid').hidden = !arts.length;
  $('#galleryEmpty').hidden = !!arts.length;
  $('#galleryEmpty').innerHTML = '<div class="empty-card center"><h3>아직 걸린 작품이 없어요</h3><p class="muted">색칠하거나 꾸미다가 <b>다 했어요!</b>를 누르면 여기에 모여요.</p></div>';
}

let artOpen = null;
async function openArt(id) {
  const a = await db.get('gallery', id);
  if (!a) return;
  artOpen = a;
  const img = $('#artImg');
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(a.image);
  $('#artTitle').textContent = a.title;
  $('#dlgArt [data-act=again]').hidden = !pictures.some((p) => p.id === a.pictureId);
  $('#dlgArt').showModal();
}

async function onArtClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const a = artOpen;
  if (!act || !a) return;
  if (act === 'close') $('#dlgArt').close();
  else if (act === 'share') await shareOrDownload(a.image, `${a.title}.jpg`);
  else if (act === 'again') {
    $('#dlgArt').close();
    const p = pictures.find((x) => x.id === a.pictureId);
    if (p) openEditor(p);
  } else if (act === 'delete') {
    if (!confirm('이 작품을 삭제할까요?')) return;
    await db.del('gallery', a.id);
    $('#dlgArt').close();
    render();
  }
}

// ---------- 설정에서 부르는 관리 기능 ----------
export function showHelp() {
  $('#helpBody').innerHTML = HELP_HTML;
  $('#dlgHelp').showModal();
}

export async function adminAction(act) {
  try {
    if (act === 'help') showHelp();
    else if (act === 'renameCat') await renameCategory();
    else if (act === 'backup') await exportBackup();
    else if (act === 'restore') {
      const f = await pickFile($('#fileRestore'));
      if (f) await importBackup(f);
    } else if (act === 'storage') {
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      const mb = (v) => (v / 1024 / 1024).toFixed(0);
      toast(est ? `사용 ${mb(est.usage)}MB / 가능 ${mb(est.quota)}MB${persisted ? ' · 보존됨' : ''} · 그림 ${pictures.length}장` : `그림 ${pictures.length}장`, 4000);
    }
  } catch (err) {
    console.error(err);
    toast('실패했어요: ' + err.message);
  }
}

async function renameCategory() {
  if (state.mode !== 'color' || state.cat.startsWith('__')) {
    toast('색칠하기 화면에서 카테고리를 하나 고른 뒤 다시 눌러 주세요', 3500);
    return;
  }
  const from = state.cat;
  const to = prompt(`'${from}' 카테고리의 새 이름`, from)?.trim();
  if (!to || to === from) return;
  for (const p of pictures.filter((x) => x.category === from)) {
    p.category = to;
    await db.put('pictures', p);
  }
  state.cat = to;
  saveState();
  await refreshLibrary();
  toast(`'${to}'(으)로 바꿨어요`);
}

// 백업 파일: "COLORPAD1 " + JSON 길이(12자리) + "\n" + JSON + 이미지들을 이어 붙인 바이너리
const MAGIC = 'COLORPAD1 ';
const HEAD = MAGIC.length + 13;

async function exportBackup() {
  toast('백업 파일 만드는 중…');
  const parts = [];
  let offset = 0;
  const add = (b) => {
    if (!b) return null;
    const ref = { o: offset, n: b.size, t: b.type };
    parts.push(b);
    offset += b.size;
    return ref;
  };
  const meta = { version: 1, pictures: [], gallery: [], kv: {} };
  for (const p of await db.all('pictures')) {
    const files = {};
    for (const k of ['line', 'sample', 'paint']) files[k] = add(await getFile(p.id, k));
    meta.pictures.push({ ...p, lineThumb: add(p.lineThumb), sampleThumb: add(p.sampleThumb), colorThumb: add(p.colorThumb), files });
  }
  for (const a of await db.all('gallery')) meta.gallery.push({ ...a, image: add(a.image), thumb: add(a.thumb) });
  for (const k of ['customWords', 'traceStars', 'customFaces']) meta.kv[k] = await getSetting(k, null);
  // 내가 넣은 얼굴 사진
  meta.faceFiles = [];
  for (const f of await customFaces()) {
    meta.faceFiles.push({ id: f.id, photo: add(await getFile(`face_${f.id}`, 'photo')), thumb: add(await getFile(`face_${f.id}`, 'thumb')) });
  }
  // 꾸미기: 얼굴마다 화장 층 그림 + 액세서리 목록
  meta.makeup = [];
  for (const f of await allFaces()) {
    const look = await getSetting(`mk:${f.id}`, null);
    if (!look) continue;
    const layers = {};
    for (const k of MK_LAYERS) layers[k] = add(await getFile(`mk_${f.id}`, k));
    meta.makeup.push({ id: f.id, acc: look.acc, at: look.at, thumb: add(look.thumb), layers, paint: add(await getFile(`mk_${f.id}`, 'paint')) });
  }
  const json = new TextEncoder().encode(JSON.stringify(meta));
  const head = new TextEncoder().encode(`${MAGIC}${String(json.length).padStart(12, '0')}\n`);
  const blob = new Blob([head, json, ...parts], { type: 'application/octet-stream' });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  await shareOrDownload(blob, `색칠놀이-백업-${stamp}.colorpad`);
}

async function importBackup(file) {
  const head = new TextDecoder().decode(await file.slice(0, HEAD).arrayBuffer());
  if (!head.startsWith(MAGIC)) throw new Error('색칠놀이 백업 파일이 아니에요');
  const len = parseInt(head.slice(MAGIC.length, MAGIC.length + 12), 10);
  const meta = JSON.parse(new TextDecoder().decode(await file.slice(HEAD, HEAD + len).arrayBuffer()));
  const base = HEAD + len;
  const get = async (r) => (r ? new Blob([await file.slice(base + r.o, base + r.o + r.n).arrayBuffer()], { type: r.t }) : null);
  if (!confirm(`그림 ${meta.pictures.length}장, 작품 ${meta.gallery.length}개를 불러올까요?\n(같은 그림은 백업 내용으로 덮어써요)`)) return;
  toast('불러오는 중…', 10000);
  for (const p of meta.pictures) {
    const { files, ...rest } = p;
    for (const k of ['line', 'sample', 'paint']) {
      const b = await get(files[k]);
      if (b) await putFile(p.id, k, b);
    }
    rest.lineThumb = await get(p.lineThumb);
    rest.sampleThumb = await get(p.sampleThumb);
    rest.colorThumb = await get(p.colorThumb);
    await db.put('pictures', rest);
  }
  for (const a of meta.gallery) await db.put('gallery', { ...a, image: await get(a.image), thumb: await get(a.thumb) });
  for (const [k, v] of Object.entries(meta.kv || {})) if (v != null) await setSetting(k, v);
  for (const f of meta.faceFiles || []) {
    for (const k of ['photo', 'thumb']) {
      const b = await get(f[k]);
      if (b) await putFile(`face_${f.id}`, k, b);
    }
  }
  for (const m of meta.makeup || []) {
    const paint = await get(m.paint);
    if (paint) await putFile(`mk_${m.id}`, 'paint', paint);
    for (const [k, ref] of Object.entries(m.layers || {})) {
      const b = await get(ref);
      if (b) await putFile(`mk_${m.id}`, k, b);
    }
    await setSetting(`mk:${m.id}`, { acc: m.acc, at: m.at, thumb: await get(m.thumb) });
  }
  await refreshLibrary();
  toast('백업을 불러왔어요');
}

const EMPTY_HTML = `
<div class="empty-card">
  <h3>첫 색칠 그림을 넣어 볼까요?</h3>
  <p class="muted">ChatGPT로 만든 선 그림을 올리면 바로 색칠할 수 있어요.</p>
  <div class="steps">
    <div><b>1</b>ChatGPT에 <br>"아이 색칠공부용 흑백 선 도안"을 부탁해요</div>
    <div><b>2</b>사진 앱이나 파일 앱에 저장해요</div>
    <div><b>3</b><strong>그림 넣기</strong>에서 골라 넣어요</div>
  </div>
  <div class="actions center"><button class="chunk" data-act="help">자세한 방법</button><button class="chunk tomato" data-act="blank">흰 도화지에 그리기</button></div>
  <p class="hint center">그림 넣기·지우기는 어른 메뉴에 있어요: 왼쪽 아래 <b>설정 버튼을 꾹</b> → <b>그림·얼굴 관리</b></p>
</div>`;

const HELP_HTML = `
<div class="help">
  <h3>ChatGPT로 도안 만들기</h3>
  <blockquote>아이 색칠공부용 도안을 그려줘. 주제: <b>우주를 나는 고양이</b>. 흰 배경에 검은색 굵은 외곽선만, 색칠·회색 음영·글자 없이, 칸을 크고 단순하게, 세로 2:3 비율로.</blockquote>
  <p>샘플(색칠본)도 만들려면 이어서:</p>
  <blockquote>방금 도안의 선과 구도는 그대로 두고, 아이가 크레파스로 예쁘게 색칠한 버전으로 만들어줘.</blockquote>
  <h3>넣는 그림 형식</h3>
  <table>
    <tr><td>파일</td><td>PNG 추천 (JPG, HEIC도 돼요)</td></tr>
    <tr><td>크기</td><td>긴 변 1024px 이상 · ChatGPT 기본 1024×1536 그대로 OK (앱이 2048px로 맞춰요)</td></tr>
    <tr><td>비율</td><td>세로 2:3 또는 3:4가 iPad 화면에 잘 맞아요</td></tr>
    <tr><td>선</td><td>흰 바탕에 검은 선, 칸이 닫혀 있어야 채우기가 잘 돼요</td></tr>
    <tr><td>샘플</td><td>도안과 같은 구도·같은 비율, 이름은 <b>도안이름_sample</b></td></tr>
  </table>
  <h3>색칠할 때</h3>
  <ul>
    <li>애플펜슬은 누르는 힘에 따라 굵기·진하기가 달라져요.</li>
    <li>펜슬을 쓰면 손가락은 확대·이동용이 돼요. 두 손가락 벌리기 = 확대, 끌기 = 이동</li>
    <li>두 손가락으로 톡 = 되돌리기, 세 손가락으로 톡 = 다시 하기</li>
    <li>샘플 그림을 누르면 그 색이 바로 골라져요.</li>
  </ul>
  <h3>글자 쓰기</h3>
  <ul>
    <li>스피커 버튼을 누르면 글자와 낱말을 읽어 줘요. 그림(이모지)을 눌러도 읽어 줘요.</li>
    <li>회색 글자를 따라 쓰고 <b>다 썼어요</b>를 누르면 별을 받아요.</li>
    <li>'내 단어' 묶음에 아이 이름이나 좋아하는 낱말을 넣을 수 있어요.</li>
  </ul>
  <h3>백업</h3>
  <p>모든 것은 이 iPad 안에만 저장돼요. 가끔 설정 → 백업 파일 만들기로 파일 앱에 저장해 두세요.</p>
</div>`;
