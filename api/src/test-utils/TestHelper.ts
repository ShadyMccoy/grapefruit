import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { Session } from "neo4j-driver";

export class TestHelper {
    static async runTest(testName: string, testFn: (session: Session, helper: TestHelper) => Promise<void>) {
        console.log(`\n--- Running Test: ${testName} ---`);
        const driver = getDriver();
        const session = driver.session();
        const helper = new TestHelper(session);

        try {
            await helper.cleanDb();
            await testFn(session, helper);
            console.log(`✅ ${testName} Passed`);
        } catch (error) {
            console.error(`❌ ${testName} Failed:`, error);
            throw error;
        } finally {
            await session.close();
            await driver.close();
        }
    }

    private containerRepo: ContainerRepo;
    private stateRepo: ContainerStateRepo;

    constructor(private session: Session) {
        this.containerRepo = new ContainerRepo(session);
        this.stateRepo = new ContainerStateRepo(session);
    }

    async cleanDb() {
        await this.session.run("MATCH (n) DETACH DELETE n");
        console.log("  🧹 Database cleaned.");
    }

    async createContainer(id: string, name: string, type: Container['type'] = 'tank', capacity: number | bigint = 10000n): Promise<Container> {
        const container: Container = {
            id,
            name,
            type,
            tenantId: "winery1",
            createdAt: new Date(),
            capacityHUnits: typeof capacity === 'number' ? BigInt(capacity) : capacity
        };
        await this.containerRepo.create(container);
        return container;
    }

    async createState(
        container: Container, 
        qty: bigint, 
        varietals: Record<string, bigint> = {}, 
        realDollars: bigint = 0n, 
        nominalDollars: bigint = 0n
    ): Promise<ContainerState> {
        const state: ContainerState = {
            id: `state_${container.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
            tenantId: container.tenantId,
            createdAt: new Date(),
            timestamp: new Date(),
            container,
            quantifiedComposition: {
                qty,
                unit: "gal",
                attributes: {
                    varietal: varietals,
                    realDollars,
                    nominalDollars
                }
            },
            flowsTo: [],
            flowsFrom: []
        };
        await this.stateRepo.create(state);
        return state;
    }

    async getHeadState(containerId: string): Promise<ContainerState | null> {
        return this.containerRepo.getHeadState(containerId);
    }
}
