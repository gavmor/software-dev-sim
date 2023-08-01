#!/usr/bin/env node

import inquirer from "inquirer"

const WAGE_CENTS = 100
const TIME_LIMIT_DAYS = 100
const STARTING_CENTS = 4000
const DAYS_PER_MONTH = 20
const FEATURE_DAY_VALUE_CENTS = 5

await run()

async function run() {
  let state = {
    days: TIME_LIMIT_DAYS,
    cents: STARTING_CENTS,
    features: 0,
    releasedValue: 0,
  }

  while (state.days > 0) {
    console.log("")
    console.log(`Days left: ${state.days}    Funds: $${dollars(state.cents)}`)
    console.log(`Codebase Size: ${loc(state.features, 0)} lines`)
    console.log(`Marketing estimates your software will make $${dollars(estimatedValueCents(state.features) * DAYS_PER_MONTH)} per month`)
    console.log(`Your current contracts bring in $${dollars(state.releasedValue * DAYS_PER_MONTH)} per month`)
    
    console.log("")
    const action = await inquirer
      .prompt({
        type: "list",
        name: "action",
        message: "what do you want to do?",
        choices: ["add a feature", "release"],
      }).then(({action}) => action).then(buildAction)
    
    console.log("")
    console.log(`You pay a programmer $${dollars(WAGE_CENTS)} to ${action.describe()}`)
    await sleep(800)

    state = await action.enact(state)

    state = passTime(state)
    state = earnRevenue(state)
  }
  
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loc(features, cruft) {
  return (features + cruft) * 100
}

function buildAction(action) {
  switch (action) {
    case "add a feature":
      return {
        describe() { return "add a feature to your software" },
        enact(state) {
          return {
            ...state,
            cents: state.cents - WAGE_CENTS,
            features: state.features + 1,
          }
        }
      }
    case "release":
      return {
        describe() { return "release the software to customers" },
        enact(state) {
          return {
            ...state,
            cents: state.cents - WAGE_CENTS,
            releasedValue: estimatedValueCents(state.features),
          }
        }
      }
  }
}

function passTime(state) {
  return {...state, days: state.days - 1}
}

function earnRevenue(state) {
  return {...state, cents: state.cents + state.releasedValue}
}

function estimatedValueCents(features) {
  return features * FEATURE_DAY_VALUE_CENTS
}

function dollars(cents) {
  return (cents / 100).toFixed(2)
}