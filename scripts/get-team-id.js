#!/usr/bin/env node

import { LinearClient } from "@linear/sdk";
import * as readline from "readline/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  console.log("Linear Team ID Finder\n");

  const apiKey = await rl.question("Enter your LINEAR_API_KEY: ");

  if (!apiKey) {
    console.error("API key is required");
    process.exit(1);
  }

  const client = new LinearClient({ apiKey });

  try {
    const teams = await client.teams();

    console.log("\n✅ Found teams:\n");

    for (const team of teams.nodes) {
      console.log(`Team: ${team.name}`);
      console.log(`Key: ${team.key}`);
      console.log(`UUID: ${team.id}`);
      console.log("");
    }

    console.log("Use the UUID value for LINEAR_TEAM_ID in your secrets.\n");
  } catch (error) {
    console.error("❌ Error fetching teams:", error.message);
    process.exit(1);
  }

  rl.close();
}

main();
