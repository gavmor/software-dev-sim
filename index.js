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
    bugs: 0,
    cruft: 0,
    unitTests: 0,
    releasedValue: 0,
  }

  while (state.days > 0) {
    console.log("")
    
    if (process.argv[2] === "debug") {
      console.log(state)
    } else {
      console.log(`Days left: ${state.days}    Funds: $${dollars(state.cents)}`)
      console.log(`Codebase Size: ${loc(state)} lines    Unit tests: ${state.unitTests}`)
      console.log(`Marketing estimates your software will make $${dollars(estimatedValueCents(state.features) * DAYS_PER_MONTH)} per month`)
      console.log(`Your current contracts bring in $${dollars(state.releasedValue * DAYS_PER_MONTH)} per month`)
    }
    
    console.log("")
    const action = await inquirer
      .prompt({
        type: "list",
        name: "action",
        message: "what do you want to do?",
        choices: ["add a feature", "refactor", "add unit tests", "release"],
      }).then(({action}) => action).then(buildAction)
    
    console.log("")
    console.log(`You pay a programmer $${dollars(WAGE_CENTS)} to ${action.describe()}`)
    await sleep(800)

    state = await action.enact(state)

    state = passTime(state)
    state = earnRevenue(state)
  }
  
  console.log("GAME OVER")
  console.log(`Your total profit was $${dollars(state.cents - STARTING_CENTS)}.`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loc({features, cruft}) {
  return (features + cruft) * 100
}

function buildAction(action) {
  switch (action) {
    case "add a feature":
      return {
        describe() { return "add a feature to your software" },
        async enact(state) {
          state = payProgrammer(state)

          if (Math.random() < featureFailureProbability(state)) {
            console.log("Unfortunately, they get stuck on some crufty code and can't finish the feature today.")
            console.log("Maybe tomorrow!")
            await(sleep(1000))
            return state
          }
          
          if (Math.random() < bugProbability(state)) {
            state = {...state, bugs: state.bugs + 1}
          }
          
          return {
            ...state,
            features: state.features + 1,
            cruft: state.cruft + 1,
          }
        }
      }
    case "refactor":
      return {
        describe() { return "tidy up the code" },
        async enact(state) {
          state = payProgrammer(state)

          if (Math.random() < bugProbability(state)) {
            state = {...state, bugs: state.bugs + 1}
          }
          
          return {
            ...state,
            cruft: Math.max(state.cruft - 1, 0),
          }
        }
      }
    case "add unit tests":
      return {
        describe() { return "write some unit tests" },
        async enact(state) {
          state = payProgrammer(state)

          return {
            ...state,
            unitTests: state.unitTests + 10,
          }
        }
      }
    case "release":
      return {
        describe() { return "release the software to customers" },
        async enact(state) {
          state = payProgrammer(state)

          if (state.bugs > 0) {
            console.log(`Unfortunately, customers report ${state.bugs} bugs. They won't pay as much for the software as you thought they would...`)
            await sleep(1000)
          }

          const netFeatures = Math.max(state.features - state.bugs, 0)

          return {
            ...state,
            features: netFeatures,
            bugs: 0,
            cruft: state.cruft + state.bugs,
            releasedValue: estimatedValueCents(netFeatures),
          }
        }
      }
  }
}

function payProgrammer(state) {
  return {...state, cents: state.cents - WAGE_CENTS}
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

function featureFailureProbability({cruft}) {
  return cruft / (cruft + 30)
}

function bugProbability({features, cruft, unitTests}) {
  const size = features + cruft
  const coverage = Math.min(1, unitTests / (size * 4))
  return Math.max(0.01, size / (size + 30) * (1 - coverage))
}

function dollars(cents) {
  return (cents / 100).toFixed(2)
}
