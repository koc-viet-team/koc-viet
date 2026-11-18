// Ghi nhớ KOC mà doanh nghiệp định book khi chưa đăng nhập (ví dụ đi từ V-HUB vào
// #/koc/<id>), để sau khi đăng nhập — kể cả sau khi đăng ký và chờ duyệt — đưa họ thẳng tới
// form booking của KOC đó. Chỉ lưu id KOC (UUID), không lưu đường dẫn, nên không thể bị lợi
// dụng để chuyển hướng tới trang khác.

export const BOOK_INTENT_KEY = "kv_book_intent";
export const BOOK_INTENT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // bao được thời gian chờ duyệt
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^[a-z0-9_-]{1,32}$/i;

export function isKocId(value) {
  return typeof value === "string" && UUID.test(value);
}

/** Tách id và tham số từ hash dạng "#/koc/<id>?ref=vhub". */
export function parseKocHash(hash) {
  const rest = String(hash || "").replace(/^#\/koc\//, "");
  const [id, query = ""] = rest.split("?");
  const ref = new URLSearchParams(query).get("ref") || "";
  return { id, ref: REF.test(ref) ? ref : "" };
}

function storage(store) {
  if (store) return store;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function rememberBookIntent(kocId, ref = "", { store, now = Date.now() } = {}) {
  const s = storage(store);
  if (!s || !isKocId(kocId)) return false;
  try {
    s.setItem(
      BOOK_INTENT_KEY,
      JSON.stringify({ id: kocId, ref: REF.test(ref) ? ref : "", at: now }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Đọc mà không xoá; trả null nếu không có, sai định dạng hoặc quá hạn. */
export function peekBookIntent({ store, now = Date.now() } = {}) {
  const s = storage(store);
  if (!s) return null;
  try {
    const v = JSON.parse(s.getItem(BOOK_INTENT_KEY) || "null");
    if (v && isKocId(v.id) && typeof v.at === "number" && now - v.at >= 0 && now - v.at < BOOK_INTENT_TTL_MS) {
      return { id: v.id, ref: typeof v.ref === "string" && REF.test(v.ref) ? v.ref : "", at: v.at };
    }
  } catch {}
  return null;
}

/** Đọc rồi xoá — dùng một lần sau khi đăng nhập. */
export function takeBookIntent(options = {}) {
  const v = peekBookIntent(options);
  try {
    storage(options.store)?.removeItem(BOOK_INTENT_KEY);
  } catch {}
  return v;
}
