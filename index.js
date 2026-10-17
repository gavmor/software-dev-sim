#!/usr/bin/env node
// Interactive console front-end for software-dev-sim.
// All game logic lives in ./src/engine.js; this file is just I/O.
import inquirer from "inquirer";
import {
  createGame,
  step,
  describe,
  profitCents,
  dollars,
  ACTION_INFO,
  WAGE_CENTS,
} from "./src/engine.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let state = createGame();

while (!state.done) {
  console.log("");

  if (process.argv[2] === "debug") {
    console.log(state);
  } else {
    describe(state).forEach((line) => console.log(line));
  }

  console.log("");
  const { action } = await inquirer.prompt({
    type: "list",
    name: "action",
    message: "what do you want to do?",
    choices: Object.entries(ACTION_INFO).map(([value, info]) => ({
      name: info.label,
      value,
    })),
  });

  console.log("");
  console.log(
    `You pay a programmer $${dollars(WAGE_CENTS)} to ${ACTION_INFO[action].enactDescription}`
  );
  await sleep(800);

  const result = step(state, action);
  state = result.state;

  for (const event of result.events) {
    if (event.type === "feature_failed") {
      console.log(ACTION_INFO.feature.failureMessage);
      await sleep(1000);
    } else if (event.type === "bugs_reported") {
      console.log(ACTION_INFO.release.bugsReportedMessage(event.count));
      await sleep(1000);
    }
  }
}

console.log("GAME OVER");
console.log(`Your total profit was $${dollars(profitCents(state))}.`);
