/**
 * software-dev-sim engine — pure, importable game logic.
 *
 * The original game is an interactive console loop. This module extracts the
 * mechanics so any front-end (CLI, browser game, Monte Carlo harness) can
 * drive them:
 *
 *   import { createGame, step, ACTIONS } from "@gavmor/software-dev-sim";
 *
 *   let game = createGame({ seed: 1234 });
 *   while (!game.done) {
 *     const { state, events } = step(game, pickAction(game));
 *     game = state;
 *   }
 *
 * Design notes:
 * - No I/O, no timers, no global RNG. The RNG is a mulberry32 stream whose
 *   state lives inside the game state, so a game is fully serializable and
 *   a seeded game replays deterministically.
 * - `step` returns a NEW state object (immutable update) plus `events`
 *   describing what happened, so UIs can narrate/animate without
 *   re-deriving anything.
 * - Mechanics are preserved exactly from the original index.js, including
 *   the quirk that bugProbability() on an empty codebase evaluates to NaN,
 *   which makes `rand() < NaN` false — i.e. zero bug risk before the first
 *   line of code exists. (Deliberately kept: this is a refactor, not a
 *   rebalance.)
 */

export const WAGE_CENTS = 100;
export const TIME_LIMIT_DAYS = 100;
export const STARTING_CENTS = 4000;
export const DAYS_PER_MONTH = 20;
export const FEATURE_DAY_VALUE_CENTS = 5;

export const ACTIONS = ["feature", "refactor", "tests", "release"];

/** Human-facing metadata for each action, for UIs. */
export const ACTION_INFO = {
  feature: {
    label: "add a feature",
    enactDescription: "add a feature to your software",
    failureMessage:
      "Unfortunately, they get stuck on some crufty code and can't finish the feature today.\nMaybe tomorrow!",
  },
  refactor: {
    label: "refactor",
    enactDescription: "tidy up the code",
  },
  tests: {
    label: "add unit tests",
    enactDescription: "write some unit tests",
  },
  release: {
    label: "release",
    enactDescription: "release the software to customers",
    bugsReportedMessage: (n) =>
      `Unfortunately, customers report ${n} bugs. They won't pay as much for the software as you thought they would...`,
  },
};

/** Tiny seeded PRNG (mulberry32). State is a single uint32. */
export function createRng(seed) {
  let a = seed >>> 0;
  return {
    get state() {
      return a >>> 0;
    },
    set state(v) {
      a = v >>> 0;
    },
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Create a fresh game state. Plain JSON-serializable data.
 * @param {{ startingCents?: number, days?: number, seed?: number }} opts
 */
export function createGame(opts = {}) {
  const {
    startingCents = STARTING_CENTS,
    days = TIME_LIMIT_DAYS,
    seed = (Math.random() * 0xffffffff) >>> 0,
  } = opts;
  return {
    day: 0,
    daysLeft: days,
    daysTotal: days,
    cents: startingCents,
    startingCents,
    features: 0,
    bugs: 0,
    cruft: 0,
    unitTests: 0,
    releasedValueCents: 0, // revenue per remaining day, in cents
    done: false,
    rngState: seed >>> 0,
  };
}

/** Probability a feature day fails outright, given cruft. */
export function featureFailureProbability(cruft) {
  return cruft / (cruft + 30);
}

/**
 * Probability a dev day introduces a bug.
 * NOTE: when features + cruft is 0 and unitTests is 0, this evaluates to NaN
 * (0/0 inside the coverage term), and `rand() < NaN` is always false — so the
 * original game has zero bug risk on an empty codebase. Preserved verbatim.
 */
export function bugProbability({ features, cruft, unitTests }) {
  const size = features + cruft;
  const coverage = Math.min(1, unitTests / (size * 4));
  return Math.max(0.01, (size / (size + 30)) * (1 - coverage));
}

/** Lines of code, as the original `loc()` computed it. */
export function codebaseLines({ features, cruft }) {
  return (features + cruft) * 100;
}

/** Marketing's monthly revenue estimate, in cents. */
export function estimatedMonthlyRevenueCents(features) {
  return features * FEATURE_DAY_VALUE_CENTS * DAYS_PER_MONTH;
}

/** Total profit so far, in cents (may be negative). */
export function profitCents(state) {
  return state.cents - state.startingCents;
}

/** Status lines for a UI, mirroring the original console output. */
export function describe(state) {
  return [
    `Days left: ${state.daysLeft}    Funds: $${dollars(state.cents)}`,
    `Codebase Size: ${codebaseLines(state)} lines    Unit tests: ${state.unitTests}`,
    `Marketing estimates your software will make $${dollars(
      estimatedMonthlyRevenueCents(state.features)
    )} per month`,
    `Your current contracts bring in $${dollars(state.releasedValueCents * DAYS_PER_MONTH)} per month`,
  ];
}

export function dollars(cents) {
  return (cents / 100).toFixed(2);
}

/**
 * Play one day. Returns { state, events } — state is a NEW object.
 * Events (for narration/animation):
 *  - { type: "feature_failed" }
 *  - { type: "feature_added" }
 *  - { type: "bug_introduced" }
 *  - { type: "refactored" }
 *  - { type: "tests_added", count }
 *  - { type: "bugs_reported", count }
 *  - { type: "released", features }
 * @throws on unknown action or when the game is already over.
 */
export function step(prev, action) {
  if (prev.done) throw new Error("cannot step: the game is over");
  if (!ACTIONS.includes(action)) throw new Error(`unknown action: ${action}`);

  const rng = createRng(prev.rngState);
  const rand = () => rng.next();
  const events = [];
  const state = { ...prev };

  state.cents -= WAGE_CENTS; // pay the programmer, whatever they do

  if (action === "feature") {
    if (rand() < featureFailureProbability(state.cruft)) {
      events.push({ type: "feature_failed" });
    } else {
      if (rand() < bugProbability(state)) {
        state.bugs += 1;
        events.push({ type: "bug_introduced" });
      }
      state.features += 1;
      state.cruft += 1;
      events.push({ type: "feature_added" });
    }
  } else if (action === "refactor") {
    if (rand() < bugProbability(state)) {
      state.bugs += 1;
      events.push({ type: "bug_introduced" });
    }
    state.cruft = Math.max(state.cruft - 1, 0);
    events.push({ type: "refactored" });
  } else if (action === "tests") {
    state.unitTests += 10;
    events.push({ type: "tests_added", count: 10 });
  } else if (action === "release") {
    const outstandingBugs = state.bugs;
    if (outstandingBugs > 0) {
      events.push({ type: "bugs_reported", count: outstandingBugs });
    }
    const netFeatures = Math.max(state.features - outstandingBugs, 0);
    state.features = netFeatures;
    state.bugs = 0;
    state.cruft += outstandingBugs; // bugs petrify into cruft
    state.releasedValueCents = netFeatures * FEATURE_DAY_VALUE_CENTS;
    events.push({ type: "released", features: netFeatures });
  }

  state.day += 1;
  state.daysLeft -= 1;
  state.cents += state.releasedValueCents; // earn revenue
  state.rngState = rng.state;
  if (state.daysLeft <= 0) state.done = true;

  return { state, events };
}
