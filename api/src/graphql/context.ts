import DataLoader from "dataloader";
import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { WineryOperation } from "../domain/nodes/WineryOperation";

export interface Context {
  loaders: {
    containerHistory: DataLoader<string, WineryOperation[]>;
  };
}

export const createContext = async (): Promise<Context> => {
  const driver = getDriver();
  
  return {
    loaders: {
      containerHistory: new DataLoader(async (ids: readonly string[]) => {
        const session = driver.session();
        try {
          const repo = new ContainerRepo(session);
          return await repo.getHistoryBatch(ids as string[]);
        } finally {
          await session.close();
        }
      })
    }
  };
};
