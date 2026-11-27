/** IndexedDB 键值存储：开库 + 增删查，全部 Promise 化。
 *  目前只服务"记住文件句柄"这一处，所以只做最小封装，不追求通用。
 *  值可以是任意可结构化克隆的对象（句柄、普通对象都行）。 */

const DB_NAME = "rp-file-cache";
const DB_VERSION = 1;
const STORE = "handles";

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

/** 在同一个事务里执行一次请求，等事务整个提交完成才算成功
 *  （只等请求成功的话，紧接着的读可能还没看到刚才的写） */
function run<T>(fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    d =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, "readwrite");
        let result: T | undefined;
        const rq = fn(tx.objectStore(STORE));
        rq.onsuccess = () => {
          result = rq.result;
        };
        tx.oncomplete = () => resolve(result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const v = await run(s => s.get(key) as IDBRequest<T | undefined>);
  return v ?? null;
}

export async function kvPut(key: string, value: unknown): Promise<void> {
  await run(s => s.put(value, key));
}

export async function kvDelete(key: string): Promise<void> {
  await run(s => s.delete(key));
}
