import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  step,
  featureFailureProbability,
  bugProbability,
  codebaseLines,
  estimatedMonthlyRevenueCents,
  profitCents,
  describe,
  dollars,
  ACTIONS,
  ACTION_INFO,
  WAGE_CENTS,
  TIME_LIMIT_DAYS,
  STARTING_CENTS,
  createKnowledge,
  updateKnowledge,
  playerView,
} from "../src/engine.js";

test("createGame returns the documented initial state", () => {
  const g = createGame({ seed: 1 });
  assert.equal(g.day, 0);
  assert.equal(g.daysLeft, TIME_LIMIT_DAYS);
  assert.equal(g.cents, STARTING_CENTS);
  assert.equal(g.features, 0);
  assert.equal(g.bugs, 0);
  assert.equal(g.cruft, 0);
  assert.equal(g.unitTests, 0);
  assert.equal(g.releasedValueCents, 0);
  assert.equal(g.done, false);
});

test("the first feature can never fail (no cruft yet)", () => {
  for (const seed of [1, 2, 3, 42, 999]) {
    const { state, events } = step(createGame({ seed }), "feature");
    assert.equal(state.features, 1);
    assert.equal(state.cruft, 1);
    assert.equal(state.cents, STARTING_CENTS - WAGE_CENTS);
    assert.equal(state.day, 1);
    assert.deepEqual(
      events.map((e) => e.type).filter((t) => t !== "bug_introduced"),
      ["feature_added"]
    );
  }
});

test("a fresh codebase has no bug risk (NaN quirk preserved)", () => {
  assert.ok(Number.isNaN(bugProbability({ features: 0, cruft: 0, unitTests: 0 })));
  // …so across many seeds, a first-day feature never introduces a bug
  for (let seed = 0; seed < 50; seed++) {
    const { state } = step(createGame({ seed }), "feature");
    assert.equal(state.bugs, 0);
  }
});

test("featureFailureProbability matches the original formula", () => {
  assert.equal(featureFailureProbability(0), 0);
  assert.equal(featureFailureProbability(30), 0.5);
  assert.ok(featureFailureProbability(1000) < 1);
});

test("bugProbability matches the original formula", () => {
  // size 30, no coverage -> 0.5 * 1 = 0.5
  assert.equal(bugProbability({ features: 20, cruft: 10, unitTests: 0 }), 0.5);
  // full coverage -> floored at 0.01
  assert.equal(bugProbability({ features: 20, cruft: 10, unitTests: 1000 }), 0.01);
});

test("refactor reduces cruft, floored at zero", () => {
  let g = createGame({ seed: 7 });
  // build some cruft first
  for (let i = 0; i < 5; i++) g = step(g, "feature").state;
  const before = g.cruft;
  assert.ok(before > 0);
  g = step(g, "refactor").state;
  assert.equal(g.cruft, before - 1);

  g = createGame({ seed: 7 });
  g = step(g, "refactor").state;
  assert.equal(g.cruft, 0);
});

test("unit tests accumulate ten per day", () => {
  let g = createGame({ seed: 7 });
  g = step(g, "tests").state;
  g = step(g, "tests").state;
  assert.equal(g.unitTests, 20);
});

test("release converts bugs to lost features and cruft, and sets revenue", () => {
  // craft a state with known features/bugs via direct construction
  let g = { ...createGame({ seed: 11 }), features: 10, bugs: 3, cruft: 4 };
  const { state, events } = step(g, "release");
  assert.equal(state.features, 7);
  assert.equal(state.bugs, 0);
  assert.equal(state.cruft, 7); // 4 + 3 bugs petrified
  assert.equal(state.releasedValueCents, 35);
  assert.deepEqual(events, [
    { type: "bugs_reported", count: 3 },
    { type: "released", features: 7 },
  ]);
});

test("release with more bugs than features zeroes the revenue stream", () => {
  let g = { ...createGame({ seed: 11 }), features: 2, bugs: 5, cruft: 1 };
  const { state } = step(g, "release");
  assert.equal(state.features, 0);
  assert.equal(state.releasedValueCents, 0);
});

test("revenue accrues every day after release", () => {
  let g = { ...createGame({ seed: 11 }), features: 10, bugs: 0 };
  g = step(g, "release").state; // releasedValueCents = 50
  const before = g.cents;
  g = step(g, "tests").state; // pay 100, earn 50
  assert.equal(g.cents, before - WAGE_CENTS + 50);
});

test("the game ends after the time limit and refuses further steps", () => {
  let g = createGame({ seed: 5, days: 3 });
  for (let i = 0; i < 3; i++) g = step(g, "feature").state;
  assert.equal(g.done, true);
  assert.throws(() => step(g, "feature"), /game is over/);
});

test("unknown actions throw", () => {
  assert.throws(() => step(createGame({ seed: 1 }), "nap"), /unknown action/);
});

test("step is immutable — the input state is untouched", () => {
  const g = createGame({ seed: 1 });
  const snapshot = { ...g };
  step(g, "feature");
  assert.deepEqual(g, snapshot);
});

test("same seed replays the identical trajectory", () => {
  const play = (seed) => {
    let g = createGame({ seed });
    const actions = ["feature", "feature", "tests", "refactor", "release", "feature"];
    for (const a of actions) g = step(g, a).state;
    return g;
  };
  assert.deepEqual(play(1234), play(1234));
  assert.notDeepEqual(play(1234), play(4321));
});

test("state is JSON-serializable (save/load round-trip)", () => {
  let g = createGame({ seed: 99 });
  g = step(g, "feature").state;
  const revived = JSON.parse(JSON.stringify(g));
  const a = step(g, "tests").state;
  const b = step(revived, "tests").state;
  assert.deepEqual(a, b);
});

test("helpers: profit, lines, revenue estimate, dollars, describe", () => {
  const g = { ...createGame({ seed: 1 }), cents: 1330, features: 47, cruft: 0, unitTests: 230 };
  assert.equal(profitCents(g), 1330 - STARTING_CENTS);
  assert.equal(codebaseLines(g), 4700);
  assert.equal(estimatedMonthlyRevenueCents(34), 3400);
  assert.equal(dollars(1330), "13.30");
  const lines = describe(g);
  assert.equal(lines.length, 4);
  assert.match(lines[0], /Days left:/);
});

test("every action has UI metadata", () => {
  assert.deepEqual([...ACTIONS].sort(), ["feature", "refactor", "release", "tests"]);
  for (const a of ACTIONS) {
    assert.ok(ACTION_INFO[a].label, a);
    assert.ok(ACTION_INFO[a].enactDescription, a);
  }
});

test("playerView hides the live bug count (fog-of-war invariant)", () => {
  // accumulate live bugs without releasing
  let game = createGame({ seed: 3 });
  let knowledge = createKnowledge();
  for (let i = 0; i < 10; i++) {
    const r = step(game, "feature");
    game = r.state;
    knowledge = updateKnowledge(knowledge, r.events);
  }
  assert.ok(game.bugs > 0, "live bugs accumulated");
  const view = playerView(game, knowledge);
  assert.equal(view.bugs, 0, "the view shows only the last reported count");
  assert.ok(!("liveBugs" in view));
});

test("a release is the only moment the view's bug count updates", () => {
  let game = createGame({ seed: 3 });
  let knowledge = createKnowledge();
  for (let i = 0; i < 10; i++) {
    const r = step(game, "feature");
    game = r.state;
    knowledge = updateKnowledge(knowledge, r.events);
  }
  const liveBugs = game.bugs;
  assert.ok(liveBugs > 0);
  const r = step(game, "release");
  game = r.state;
  knowledge = updateKnowledge(knowledge, r.events);
  assert.equal(knowledge.knownBugs, liveBugs);
  assert.equal(playerView(game, knowledge).bugs, liveBugs);
  // a clean release resets the known count to zero
  const r2 = step(game, "release");
  const knowledge2 = updateKnowledge(knowledge, r2.events);
  assert.equal(playerView(r2.state, knowledge2).bugs, 0);
});

test("updateKnowledge is immutable", () => {
  const k = createKnowledge();
  const snapshot = { ...k };
  updateKnowledge(k, [{ type: "released", features: 5 }]);
  assert.deepEqual(k, snapshot);
});

test("playerView xray mode carries the live count (explicit lab override)", () => {
  let game = createGame({ seed: 3 });
  const knowledge = createKnowledge();
  for (let i = 0; i < 10; i++) game = step(game, "feature").state;
  assert.ok(game.bugs > 0);
  assert.equal(playerView(game, knowledge, { xray: true }).bugs, game.bugs);
});

test("playerView exposes exactly the player-observable fields", () => {
  const game = createGame({ seed: 1 });
  const view = playerView(game, createKnowledge());
  assert.deepEqual(Object.keys(view).sort(), [
    "bugs",
    "cents",
    "cruft",
    "day",
    "daysLeft",
    "daysTotal",
    "done",
    "features",
    "releasedValueCents",
    "startingCents",
    "unitTests",
  ]);
});
