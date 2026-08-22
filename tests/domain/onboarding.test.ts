import test from "node:test";
import assert from "node:assert/strict";

import { addActivity, buildCategories, completeOnboarding, removeActivity, setActivityGoal } from "../../src/domain/onboarding.ts";
import { createDefaultState } from "../../src/domain/state.ts";
import { createProfile } from "../../src/domain/profile.ts";

test("activities are added once each, trimmed, and capped at the board's four buttons", () => {
  let drafts = addActivity([], "  운동 ");
  drafts = addActivity(drafts, "운동");
  drafts = addActivity(drafts, "독서");
  drafts = addActivity(drafts, "공부");
  drafts = addActivity(drafts, "영어");
  drafts = addActivity(drafts, "다섯째");

  assert.deepEqual(drafts.map((draft) => draft.name), ["운동", "독서", "공부", "영어"]);
  assert.equal(drafts[0]?.goalType, "daily");
  assert.equal(drafts[0]?.goal, 30, "a sensible default so the next step is a tweak, not a blank");
});

test("an empty name is ignored and removal works by name", () => {
  assert.deepEqual(addActivity([], "   "), []);
  const drafts = addActivity(addActivity([], "운동"), "독서");
  assert.deepEqual(removeActivity(drafts, "운동").map((draft) => draft.name), ["독서"]);
});

test("goals follow their unit's ceiling", () => {
  const drafts = addActivity([], "프로젝트");
  assert.equal(setActivityGoal(drafts, "프로젝트", "weekly", 9999)[0]?.goal, 5040);
  assert.equal(setActivityGoal(drafts, "프로젝트", "daily", 9999)[0]?.goal, 720);
  assert.equal(setActivityGoal(drafts, "프로젝트", "daily", -5)[0]?.goal, 0);
});

test("categories get distinct colours and ids", () => {
  const categories = buildCategories([
    { name: "운동", goalType: "daily", goal: 30 },
    { name: "독서", goalType: "weekly", goal: 300 },
  ]);
  assert.equal(new Set(categories.map((category) => category.color)).size, 2);
  assert.equal(new Set(categories.map((category) => category.id)).size, 2);
  assert.equal(categories[1]?.goalType, "weekly");
});

test("finishing onboarding replaces the demo with the person's own empty record", () => {
  const demo = createDefaultState();
  assert.ok(demo.sessions.length > 0, "the demo state ships with records");
  const profile = createProfile("수", "spike", "")!;
  const done = completeOnboarding(demo, profile, [
    { name: "운동", goalType: "daily", goal: 30 },
    { name: "글쓰기", goalType: "weekly", goal: 300 },
  ]);

  assert.equal(done.profile?.name, "수");
  assert.deepEqual(done.categories.map((category) => category.name), ["운동", "글쓰기"]);
  assert.deepEqual(done.assignments, done.categories.map((category) => category.id));
  assert.deepEqual(done.sessions, [], "none of the demo's records should look like their life");
  assert.equal(done.activeSession, null);
  assert.equal(done.companion, demo.companion, "companion settings survive");
});

test("onboarding without a single activity is refused", () => {
  assert.throws(() => completeOnboarding(createDefaultState(), createProfile("수", "spike", "")!, []), /at least one activity/);
});
