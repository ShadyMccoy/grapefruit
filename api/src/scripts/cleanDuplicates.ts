import { getDriver } from "../db/client";

async function cleanDuplicates() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log("🧹 Cleaning duplicate operations...");

    // Find duplicates
    const result = await session.run(`
      MATCH (op:WineryOperation)
      WITH op.id as id, collect(op) as ops, count(op) as count
      WHERE count > 1
      RETURN id, count
    `);

    console.log(`Found ${result.records.length} duplicate groups.`);

    // Delete duplicates (keep one)
    const deleteResult = await session.run(`
      MATCH (op:WineryOperation)
      WITH op.id as id, collect(op) as ops, count(op) as count
      WHERE count > 1
      UNWIND ops[1..] as duplicate
      DETACH DELETE duplicate
      RETURN count(duplicate) as deleted
    `);

    const deleted = deleteResult.records.reduce((sum, r) => sum + r.get("deleted").toNumber(), 0);
    console.log(`✅ Deleted ${deleted} duplicate operations.`);

  } catch (error) {
    console.error(error);
  } finally {
    await session.close();
    await driver.close();
  }
}

cleanDuplicates();