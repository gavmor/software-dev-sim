# Software Development Simulation

A silly console game that simulates running a software business.

Run it with `node index.js` (or `npm start`).

```
You pay a programmer $1.00 to add a feature to your software
Unfortunately, they get stuck on some crufty code and can't finish the feature today.
Maybe tomorrow!

Days left: 4    Funds: $13.30
Codebase Size: 4700 lines    Unit tests: 230
Marketing estimates your software will make $34.00 per month
Your current contracts bring in $34.00 per month
```

Forked from [benchristel/software-dev-sim](https://github.com/benchristel/software-dev-sim).

## Importable engine

The game logic lives in `src/engine.js` — pure, dependency-free, and
deterministic when seeded. Any front-end (CLI, browser game, bot, Monte Carlo
harness) can drive it:

```js
import { createGame, step, ACTIONS } from "@gavmor/software-dev-sim";

let game = createGame({ seed: 1234 }); // omit seed for a random game
while (!game.done) {
  const action = pickAction(game); // "feature" | "refactor" | "tests" | "release"
  const { state, events } = step(game, action); // immutable update + narration events
  game = state;
}
console.log("profit: $" + (game.cents - game.startingCents) / 100);
```

Key exports: `createGame`, `step`, `ACTIONS`, `ACTION_INFO` (UI labels),
`describe` (status lines), `profitCents`, `featureFailureProbability`,
`bugProbability`, `codebaseLines`, `dollars`. Game state is plain
JSON-serializable data, so saving/loading is `JSON.stringify`/`JSON.parse`.

Events returned by `step` (for narration or animation): `feature_failed`,
`feature_added`, `bug_introduced`, `refactored`, `tests_added`,
`bugs_reported`, `released`.

## Fog of war

In the original game you never learn the live bug count — customers report
bugs only when you release. Strategies must observe the game through
`playerView()`, never through raw `GameState`:

```js
import { createGame, step, createKnowledge, updateKnowledge, playerView } from "@gavmor/software-dev-sim";

let game = createGame({ seed: 42 });
let knowledge = createKnowledge();
while (!game.done) {
  const view = playerView(game, knowledge); // ← the strategy sees only this
  const { state, events } = step(game, pickAction(view));
  knowledge = updateKnowledge(knowledge, events); // releases reveal the bug count
  game = state;
}
```

`playerView()` is the single choke point: under fog of war its `bugs` field
is the last *reported* count, so a strategy typed against the view cannot
observe — or even name — the live value. Pass `{ xray: true }` for the
explicit lab override, where the view carries the live count instead.

## Install from GitHub Packages

```sh
npm install @gavmor/software-dev-sim
```

with an `.npmrc` containing:

```
@gavmor:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

## Developing

```sh
npm ci
npm test   # node:test suite, no extra dependencies
```

Releases are cut from GitHub: pushing a tag like `v1.0.0` that matches
`package.json`'s version and publishing a GitHub Release runs the
*Publish to GitHub Packages* workflow, which tests and publishes the package.
