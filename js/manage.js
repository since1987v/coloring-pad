// 어른용 '그림·얼굴 관리' 화면: 색칠 그림과 꾸미기 얼굴 사진을 넣고·고치고·지운다.
// 설정 버튼을 꾹 눌러 연 설정 창 안에서만 들어올 수 있다
import { $, $$, toast, pickFile, showScreen } from './util.js';
import { getFile } from './store.js';
import { listPictures, openAdd, openEdit, removePicture } from './library.js';
import { customFaces, addCustomFace, deleteCustomFace, openFaceFit } from './makeup.js';

let tab = 'pics';
let urls = [];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const url = (b) => {
  if (!b) return '';
  const u = URL.createObjectURL(b);
  urls.push(u);
  return u;
};

export function initManage() {
  $('#mgBack').addEventListener('click', () => showScreen('library'));
  $('#mgSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    render();
  });
  $('#mgAdd').addEventListener('click', async () => {
    if (tab === 'pics') {
      openAdd();
      return;
    }
    const f = await pickFile($('#fileFace'));
    if (!f) return;
    toast('사진을 넣는 중…');
    try {
      const face = await addCustomFace(f);
      await render();
      openFaceFit(face, render);
    } catch (err) {
      console.error(err);
      toast('사진을 넣지 못했어요: ' + err.message);
    }
  });
  $('#mgList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    const row = e.target.closest('[data-id]');
    if (!b || !row) return;
    const id = row.dataset.id;
    if (tab === 'pics') {
      const p = listPictures().find((x) => x.id === id);
      if (!p) return;
      if (b.dataset.act === 'edit') openEdit(p);
      else if (b.dataset.act === 'del') await removePicture(p);
      return;
    }
    const face = (await customFaces()).find((x) => x.id === id);
    if (!face) return;
    if (b.dataset.act === 'fit') openFaceFit(face, render);
    else if (b.dataset.act === 'del') {
      if (!confirm(`'${face.name}' 얼굴 사진을 지울까요?\n(이 얼굴에 한 화장·액세서리도 같이 지워져요. 내 작품에 건 것은 남아요)`)) return;
      await deleteCustomFace(id);
      toast('얼굴 사진을 지웠어요');
      render();
    }
  });
  document.addEventListener('library-changed', () => {
    if ($('#manage').classList.contains('active')) render();
  });
}

export function openManage() {
  showScreen('manage');
  render();
}

async function render() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
  $$('#mgSeg button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $('#mgAddLbl').textContent = tab === 'pics' ? '그림 넣기' : '얼굴 사진 넣기';
  const list = $('#mgList');
  if (tab === 'pics') {
    const pics = [...listPictures()].sort((a, b) => b.createdAt - a.createdAt);
    $('#mgHint').textContent = pics.length
      ? `그림 ${pics.length}장 · 정보 바꾸기에서 이름·카테고리·샘플을 고칠 수 있어요`
      : '아직 넣은 그림이 없어요. 오른쪽 위 ‘그림 넣기’를 눌러 주세요.';
    list.innerHTML = pics
      .map(
        (p) => `<div class="mg-row" data-id="${esc(p.id)}">
          <img alt="" src="${url(p.blank && p.colorThumb ? p.colorThumb : p.lineThumb)}">
          <div class="mg-text"><b>${esc(p.title)}</b><small>${esc(p.blank ? '흰 도화지' : p.category || '미분류')}${p.hasSample ? ' · 샘플 있음' : ''}${p.coloredAt ? ' · 색칠함' : ''}</small></div>
          <button class="chunk small" data-act="edit">정보 바꾸기</button>
          <button class="chunk small danger" data-act="del">지우기</button>
        </div>`,
      )
      .join('');
    return;
  }
  const faces = await customFaces();
  $('#mgHint').textContent = faces.length
    ? '얼굴 사진을 넣고 눈·입 위치를 맞추면 꾸미기에 나와요. 정면을 보는 밝은 사진이 잘 돼요.'
    : '가족이나 좋아하는 사람의 얼굴 사진을 넣어 꾸밀 수 있어요. 오른쪽 위 ‘얼굴 사진 넣기’를 눌러 주세요.';
  const thumbs = await Promise.all(faces.map((f) => getFile(`face_${f.id}`, 'thumb')));
  list.innerHTML = faces
    .map(
      (f, i) => `<div class="mg-row" data-id="${esc(f.id)}">
        <img alt="" src="${url(thumbs[i])}">
        <div class="mg-text"><b>${esc(f.name)}</b><small>꾸미기 얼굴</small></div>
        <button class="chunk small" data-act="fit">눈·입 맞추기</button>
        <button class="chunk small danger" data-act="del">지우기</button>
      </div>`,
    )
    .join('');
}
