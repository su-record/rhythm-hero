import test from "node:test";
import assert from "node:assert/strict";

import { readStoredValue, writeStoredValue } from "../../src/store/storage.ts";

function withLocalStorage(implementation: Storage | undefined, run: () => void): void {
  const original = Reflect.get(globalThis, "localStorage") as Storage | undefined;
  if (implementation) Reflect.set(globalThis, "localStorage", implementation);
  else Reflect.deleteProperty(globalThis, "localStorage");
  try {
    run();
  } finally {
    if (original) Reflect.set(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

function workingStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

function throwingStorage(): Storage {
  return {
    getItem: () => { throw new Error("access denied"); },
    setItem: () => { throw new Error("quota exceeded"); },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

test("values round-trip through localStorage when it works", () => {
  withLocalStorage(workingStorage(), () => {
    writeStoredValue("rhythm-hero-probe", "42");
    assert.equal(readStoredValue("rhythm-hero-probe"), "42");
  });
});

test("a storage that throws falls back to memory instead of losing the record", () => {
  withLocalStorage(throwingStorage(), () => {
    writeStoredValue("rhythm-hero-blocked", "kept");
    assert.equal(readStoredValue("rhythm-hero-blocked"), "kept");
  });
});

test("a missing localStorage is survivable", () => {
  withLocalStorage(undefined, () => {
    writeStoredValue("rhythm-hero-absent", "still here");
    assert.equal(readStoredValue("rhythm-hero-absent"), "still here");
    assert.equal(readStoredValue("rhythm-hero-never-written"), null);
  });
});
