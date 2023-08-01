#!/usr/bin/env node

import inquirer from "inquirer"

inquirer
  .prompt({
    type: "list",
    name: "color",
    message: "what is your favorite color?",
    choices: ["blue", "green"],
  })
  .then((answer) => {
    console.log(answer)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1);
  })