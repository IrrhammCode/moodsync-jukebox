import { VectorEngine } from "./lib/vectorEngine";

async function runSeeder() {
  console.log("🌱 Compiling Fake 'Danger' Trajectory for AURA Foresight...");
  
  // We simulate a user who started focused, but is now getting sad and bored.
  const dangerTrajectory = "happy -> neutral -> sad";
  
  // The 'future' mood if left un-intervened:
  const predictedDisaster = "depressed_burnout";

  console.log(`Sending to Turbopuffer: Pattern [${dangerTrajectory}] leads to [${predictedDisaster}]`);

  // We are forcing this memory into the vector DB for demonstration
  await VectorEngine.memorizeTrajectory("GLOBAL_SEED_ROOM", dangerTrajectory, predictedDisaster);

  console.log("✅ Seed complete! AURA now 'knows' that happy->neutral->sad leads to depression.");
  process.exit(0);
}

runSeeder();
