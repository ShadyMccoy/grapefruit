import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { Context } from "./context";

export const resolvers = {
  Query: {
    containers: async (_: any, { limit, offset }: { limit?: number, offset?: number }) => {
      const driver = getDriver();
      const session = driver.session();
      try {
        const repo = new ContainerRepo(session);
        return await repo.findAll(limit, offset);
      } finally {
        await session.close();
      }
    },
    container: async (_: any, { id }: { id: string }) => {
      const driver = getDriver();
      const session = driver.session();
      try {
        const repo = new ContainerRepo(session);
        return await repo.findById(id);
      } finally {
        await session.close();
      }
    },
    operations: async () => {
      // WineryOperationRepo.findAll is static, but let's check if it needs a session or handles it internally.
      // Looking at the file, it handles driver/session internally.
      return await WineryOperationRepo.findAll();
    }
  },
  Container: {
    currentState: async (parent: any) => {
      if (parent.currentState) return parent.currentState;
      const driver = getDriver();
      const session = driver.session();
      try {
        const repo = new ContainerRepo(session);
        return await repo.getHeadState(parent.id);
      } finally {
        await session.close();
      }
    },
    capacityHUnits: (parent: any) => parent.capacityHUnits?.toString(),
    members: async (parent: any) => {
      if (parent.type !== 'barrel-group') return null;
      const driver = getDriver();
      const session = driver.session();
      try {
        const repo = new ContainerRepo(session);
        return await repo.getGroupMembers(parent.id);
      } finally {
        await session.close();
      }
    },
    history: async (parent: any, _args: any, context: Context) => {
      return context.loaders.containerHistory.load(parent.id);
    }
  },
  ContainerState: {
    quantifiedComposition: (parent: any) => ({
      qty: parent.quantifiedComposition.qty.toString(),
      unit: parent.quantifiedComposition.unit,
      attributes: parent.quantifiedComposition.attributes
    }),
    timestamp: (parent: any) => parent.timestamp.toISOString(),
    container: async (parent: any) => {
      const driver = getDriver();
      const session = driver.session();
      try {
        const result = await session.run(
          `
          MATCH (s:ContainerState {id: $id})-[:STATE_OF]->(c:Container)
          RETURN c
          `,
          { id: parent.id }
        );
        return result.records[0]?.get('c').properties;
      } finally {
        await session.close();
      }
    }
  },
  WineryOperation: {
    timestamp: (parent: any) => parent.createdAt ? new Date(parent.createdAt).toISOString() : null
  }
};
