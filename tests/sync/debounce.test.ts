import test from "node:test";
import assert from "node:assert/strict";

import { createDebouncer } from "../../src/sync/debounce.ts";

test("a burst of changes collapses into one write after the quiet period", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const debouncer = createDebouncer(650);
  let writes = 0;

  debouncer.schedule(() => { writes += 1; });
  t.mock.timers.tick(300);
  debouncer.schedule(() => { writes += 1; });
  t.mock.timers.tick(300);
  debouncer.schedule(() => { writes += 1; });

  assert.equal(writes, 0, "nothing is written while changes keep arriving");
  t.mock.timers.tick(649);
  assert.equal(writes, 0);
  t.mock.timers.tick(1);
  assert.equal(writes, 1, "exactly one write lands after the burst");
});

test("cancelling before the delay prevents the write", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const debouncer = createDebouncer(650);
  let writes = 0;

  debouncer.schedule(() => { writes += 1; });
  debouncer.cancel();
  t.mock.timers.tick(5000);

  assert.equal(writes, 0, "an unmounted view must not push state after teardown");
});
