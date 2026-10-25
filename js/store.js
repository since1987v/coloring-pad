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

// iPad Safari는 IndexedDB에 Blob을 넣다가 가끔 "Error preparing Blob/File data to be stored" 로 실패한다.
// 그래서 Blob은 ArrayBuffer(+종류)로 바꿔 넣고, 꺼낼 때 다시 Blob으로 만든다. 예전에 넣은 Blob도 그대로 읽힌다.
const isBlob = (v) => typeof Blob !== 'undefined' && v instanceof Blob;
const isPacked = (v) => v && typeof v === 'object' && v.__b instanceof ArrayBuffer;
const packOne = async (b) => ({ __b: await b.arrayBuffer(), t: b.type });

async function pack(v) {
  if (isBlob(v)) return packOne(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    let out = null;
    for (const [k, x] of Object.entries(v)) {
      if (!isBlob(x)) continue;
      out ??= { ...v };
      out[k] = await packOne(x);
    }
    return out || v;
  }
  return v;
}

function unpack(v) {
  if (isPacked(v)) return new Blob([v.__b], { type: v.t });
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    let out = null;
    for (const [k, x] of Object.entries(v)) {
      if (!isPacked(x)) continue;
      out ??= { ...v };
      out[k] = new Blob([x.__b], { type: x.t });
    }
    return out || v;
  }
  return v;
}

export const db = {
  get: async (s, k) => unpack(await wrap((await os(s, 'readonly')).get(k))),
  all: async (s) => (await wrap((await os(s, 'readonly')).getAll())).map(unpack),
  put: async (s, v, k) => {
    // 변환(await)을 다 끝낸 뒤 트랜잭션을 연다. 중간에 기다리면 트랜잭션이 저절로 닫힌다
    const value = await pack(v);
    const store = await os(s, 'readwrite');
    return wrap(k === undefined ? store.put(value) : store.put(value, k));
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
