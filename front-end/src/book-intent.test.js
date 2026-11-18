import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOK_INTENT_KEY,
  BOOK_INTENT_TTL_MS,
  parseKocHash,
  peekBookIntent,
  rememberBookIntent,
  takeBookIntent,
} from "./book-intent.js";

const ID = "4b01aad8-3b76-4fc6-9362-72cdfaf8f57b";

function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test("profile hash keeps the KOC id clean when V-HUB adds ?ref=vhub", () => {
  assert.deepEqual(parseKocHash(`#/koc/${ID}?ref=vhub`), { id: ID, ref: "vhub" });
  assert.deepEqual(parseKocHash(`#/koc/${ID}`), { id: ID, ref: "" });
  assert.equal(parseKocHash(`#/koc/${ID}?ref=<script>`).ref, "");
});

test("remembered KOC comes back once after login", () => {
  const store = memoryStore();
  assert.equal(rememberBookIntent(ID, "vhub", { store, now: 1000 }), true);
  assert.deepEqual(peekBookIntent({ store, now: 2000 }), { id: ID, ref: "vhub", at: 1000 });
  assert.equal(takeBookIntent({ store, now: 2000 }).id, ID);
  assert.equal(takeBookIntent({ store, now: 2000 }), null);
});

test("only a KOC UUID is stored, never a path", () => {
  const store = memoryStore();
  assert.equal(rememberBookIntent("../../admin", "", { store }), false);
  assert.equal(rememberBookIntent("https://evil.example", "", { store }), false);
  assert.equal(store.getItem(BOOK_INTENT_KEY), null);
  store.setItem(BOOK_INTENT_KEY, JSON.stringify({ id: "#/admin", at: Date.now() }));
  assert.equal(takeBookIntent({ store }), null);
  store.setItem(BOOK_INTENT_KEY, "{not json");
  assert.equal(takeBookIntent({ store }), null);
});

test("intent expires after the approval window", () => {
  const store = memoryStore();
  rememberBookIntent(ID, "", { store, now: 0 });
  assert.equal(peekBookIntent({ store, now: BOOK_INTENT_TTL_MS - 1 })?.id, ID);
  assert.equal(takeBookIntent({ store, now: BOOK_INTENT_TTL_MS }), null);
  assert.equal(store.getItem(BOOK_INTENT_KEY), null);
});
