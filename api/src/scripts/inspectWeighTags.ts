// src/scripts/inspectWeighTags.ts
import { getDriver } from "../db/client";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const result = await session.run("MATCH (w:WeighTag) RETURN w");
    console.log(`\nWeighTags in database: ${result.records.length}`);
    result.records.forEach(r => {
      const w = r.get('w').properties;
      console.log(`  ${w.tagNumber}: ${w.weightLbs} lbs, vintage ${w.vintage}`);
    });
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
