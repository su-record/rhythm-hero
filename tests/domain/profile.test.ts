import test from "node:test";
import assert from "node:assert/strict";

import { createProfile, normalizeProfileName, toyArt } from "../../src/domain/profile.ts";
import { createDefaultState, normalizeState } from "../../src/domain/state.ts";
import { resetDemo, setProfile } from "../../src/store/actions.ts";
import type { AppState } from "../../src/domain/types.ts";

test("a profile needs a name and a known toy; the toy name falls back to the family label", () => {
  assert.equal(createProfile("   ", "spike", ""), null);
  assert.equal(createProfile("수", "dragon" as never, ""), null);

  const profile = createProfile("  수  ", "bouncer", "");
  assert.equal(profile?.name, "수");
  assert.equal(profile?.toyName, "바운서");
  assert.ok(profile?.createdAt);
});

test("names are trimmed, collapsed and capped at twelve characters", () => {
  assert.equal(normalizeProfileName("  김   수  "), "김 수");
  assert.equal(normalizeProfileName("가".repeat(30)).length, 12);
  assert.equal(normalizeProfileName(undefined), "");
});

test("pink waits and blue moves for every family", () => {
  assert.equal(toyArt("spike", false), "./assets/characters/spike-pink.png");
  assert.equal(toyArt("spike", true), "./assets/characters/spike-blue.png");
  assert.equal(toyArt("bouncer", true), "./assets/characters/bouncer-blue.png");
});

test("a fresh install has no owner, so the app must ask before writing records", () => {
  assert.equal(createDefaultState().profile, null);
});

test("a stored profile survives normalization and a broken one is dropped rather than crashing", () => {
  const good = normalizeState({ ...createDefaultState(), profile: { name: " 수 ", toy: "spike", toyName: "", createdAt: "" } });
  assert.deepEqual({ name: good.profile?.name, toy: good.profile?.toy, toyName: good.profile?.toyName }, { name: "수", toy: "spike", toyName: "spike" });
  assert.ok(good.profile?.createdAt);

  const broken = normalizeState({ ...createDefaultState(), profile: { name: "", toy: "ghost" } as unknown as AppState["profile"] });
  assert.equal(broken.profile, null);
});

test("resetting the demo keeps the person and their companion settings", () => {
  const owned = setProfile(createDefaultState(), createProfile("수", "bouncer", "통통")!);
  const tuned = { ...owned, companion: { voice: false, idleMinutes: 5 }, sessions: [] };
  const reset = resetDemo(tuned);

  assert.equal(reset.profile?.name, "수");
  assert.equal(reset.profile?.toyName, "통통");
  assert.deepEqual(reset.companion, { voice: false, idleMinutes: 5 });
  assert.ok(reset.sessions.length > 0, "the demo records come back");
});
