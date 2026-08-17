import { describe, expect, test } from "bun:test";

import { createOptionsSnapshot, fingerprint, stableSerialize } from "../../src/specification/specification.hash";

describe("规格指纹", () => {
  const key = new Uint8Array(32).fill(7);

  test("对象字段顺序不影响指纹", () => {
    expect(fingerprint({ first: 1, second: 2 }, key)).toBe(fingerprint({ second: 2, first: 1 }, key));
  });

  test("状态快照不保存秘密明文", () => {
    const snapshot = createOptionsSnapshot(
      { user: "postgres", password: "do-not-store", nested: [{ token: "private" }] },
      ["password", "nested.*.token"],
      key,
    );
    const serialized = stableSerialize(snapshot);

    expect(serialized).not.toContain("do-not-store");
    expect(serialized).not.toContain("private");
    expect(serialized).toContain("secretFingerprint");
    expect(serialized).toContain("postgres");
  });
});
