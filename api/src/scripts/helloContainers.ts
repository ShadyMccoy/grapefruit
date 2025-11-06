import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";

(async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const repo = new ContainerRepo(session);
    const containers = await repo.findAll();
    console.log("Containers:", containers);
  } catch (e) {
    console.error(e);
  } finally {
    await session.close();
    await driver.close();
  }
})();
