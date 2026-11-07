import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintCsv } from "../dist/index.js";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

describe("fuzz", () => {
  it("does not throw on random bytes, random text, or a bare percent", () => {
    const random = mulberry32(0x5eed);
    for (let index = 0; index < 2000; index += 1) {
      const length = Math.floor(random() * 240);
      const bytes = new Uint8Array(length);
      for (let cursor = 0; cursor < length; cursor += 1) bytes[cursor] = Math.floor(random() * 256);
      assert.doesNotThrow(() => lintCsv(bytes));
      let text = "";
      const chars = Math.floor(random() * 180);
      for (let cursor = 0; cursor < chars; cursor += 1) {
        text += String.fromCharCode(Math.floor(random() * 512));
      }
      assert.doesNotThrow(() => lintCsv(text));
    }
    assert.doesNotThrow(() => lintCsv("Title,Product image URL\nHat,https://cdn.example.com/100%_cotton.jpg\n"));
    assert.doesNotThrow(() => lintCsv("Title,Product image URL\nHat,https://x.com/50%-off.jpg\n"));
  });
});
