// 모든 데이터는 iPad 안의 IndexedDB에 저장된다 (서버 없음)
//  pictures : 그림 정보 + 작은 미리보기
//  files    : `${id}:line` 도안, `${id}:sample` 샘플, `${id}:paint` 색칠한 층
//  gallery  : 완성 저장한 작품
//  kv       : 설정
const DB_NAME = 'coloring-pad';
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('pictures')) d.createObjectStore('pictures', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
        if (!d.objectStoreNames.contains('gallery')) d.createObjectStore('gallery', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

const wrap = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

async function os(name, mode) {
  const d = await openDb();
  return d.transaction(name, mode).objectStore(name);
}

// iPad Safari는 IndexedDB의 Blob을 다루다 두 가지로 실패한다.
//  · 넣을 때: "Error preparing Blob/File data to be stored"
//  · 예전에 꺼낸 Blob을 다시 읽을 때: 그사이 저장소 쪽 파일이 지워져 "The object can not be found here"
// 그래서 Blob은 ArrayBuffer(+종류)로 바꿔 넣고, 꺼낼 때는 메모리에만 있는 Blob으로 만들어 돌려준다(다시 읽어도 사라지지 않는다).
// 못 읽는 Blob이 있으면 저장소에 남아 있는 값을 대신 쓴다.
const isBlob = (v) => typeof Blob !== 'undefined' && v instanceof Blob;
const isPacked = (v) => v && typeof v === 'object' && v.__b instanceof ArrayBuffer;
const MISSING = Symbol('missing');

async function readBlob(b) {
  try {
    return await b.arrayBuffer();
  } catch {
    return null;
  }
}

// 넣을 값으로 바꾼다. 원래 객체의 Blob도 메모리 Blob으로 바꿔 두어, 앱이 들고 있는 그림이 나중에 사라지지 않게 한다
async function pack(v) {
  if (isBlob(v)) {
    const buf = await readBlob(v);
    return buf ? { __b: buf, t: v.type } : MISSING;
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    let out = null;
    for (const [k, x] of Object.entries(v)) {
      if (!isBlob(x)) continue;
      out ??= { ...v };
      const buf = await readBlob(x);
      if (buf) {
        out[k] = { __b: buf, t: x.type };
        v[k] = new Blob([buf], { type: x.type });
      } else out[k] = MISSING;
    }
    return out || v;
  }
  return v;
}

// 꺼낸 값을 메모리 Blob으로 바꾼다. 예전 방식(저장소 Blob)으로 남아 있던 것도 읽어서 바꾸고, 못 읽으면 비운다
async function unpackOne(x) {
  if (isPacked(x)) return new Blob([x.__b], { type: x.t });
  if (isBlob(x)) {
    const buf = await readBlob(x);
    return buf ? new Blob([buf], { type: x.type }) : null;
  }
  return x;
}

async function unpack(v) {
  if (isPacked(v) || isBlob(v)) return unpackOne(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    let out = null;
    for (const [k, x] of Object.entries(v)) {
      if (!isPacked(x) && !isBlob(x)) continue;
      out ??= { ...v };
      out[k] = await unpackOne(x);
    }
    return out || v;
  }
  return v;
}

export const db = {
  get: async (s, k) => unpack(await wrap((await os(s, 'readonly')).get(k))),
  all: async (s) => Promise.all((await wrap((await os(s, 'readonly')).getAll())).map(unpack)),
  put: async (s, v, k) => {
    // 변환(await)을 다 끝낸 뒤 트랜잭션을 연다. 중간에 기다리면 트랜잭션이 저절로 닫힌다
    const value = await pack(v);
    if (value === MISSING) return undefined; // 통째로 못 읽는 파일은 저장소에 있는 것을 그대로 둔다
    const store = await os(s, 'readwrite');
    const missing = value && typeof value === 'object' ? Object.keys(value).filter((x) => value[x] === MISSING) : [];
    if (!missing.length) return wrap(k === undefined ? store.put(value) : store.put(value, k));
    // 못 읽은 칸은 저장소에 이미 있는 값으로 채운다 (같은 트랜잭션 안에서 읽고 바로 쓴다)
    return new Promise((resolve, reject) => {
      const g = store.get(k === undefined ? value.id : k);
      g.onsuccess = () => {
        const old = g.result || {};
        for (const x of missing) value[x] = old[x] ?? null;
        const p = k === undefined ? store.put(value) : store.put(value, k);
        p.onsuccess = () => resolve(p.result);
        p.onerror = () => reject(p.error);
      };
      g.onerror = () => reject(g.error);
    });
  },
  del: async (s, k) => wrap((await os(s, 'readwrite')).delete(k)),
};

const fileKey = (id, kind) => `${id}:${kind}`;
export const getFile = (id, kind) => db.get('files', fileKey(id, kind));
export const putFile = (id, kind, blob) => db.put('files', blob, fileKey(id, kind));
export const delFile = (id, kind) => db.del('files', fileKey(id, kind));

export async function deletePicture(id) {
  await db.del('pictures', id);
  await Promise.all(['line', 'sample', 'paint'].map((k) => delFile(id, k)));
}

export async function getSetting(k, def) {
  const v = await db.get('kv', k);
  return v === undefined ? def : v;
}
export const setSetting = (k, v) => db.put('kv', v, k);
