import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { WineryOperationService } from "../core/WineryOperationService";
import { starterData } from "./starterData";
import { ContainerState } from "../domain/nodes/ContainerState";
import { Container } from "../domain/nodes/Container";
import { v4 as uuidv4 } from 'uuid';
import neo4j, { Record } from "neo4j-driver";
import { deserializeAttributes } from "../util/attributeSerialization";

async function cleanDb(session: any) {
    console.log("Cleaning database...");
    await session.run("MATCH (n) DETACH DELETE n");
}

async function seedData(session: any) {
    console.log("Seeding starter data...");
    const containerRepo = new ContainerRepo(session);
    const stateRepo = new ContainerStateRepo(session);

    for (const c of starterData.containers) {
        await containerRepo.create(c);
    }
    for (const s of starterData.containerStates) {
        await stateRepo.create(s);
    }
}

async function getAllHeadStates(session: any): Promise<ContainerState[]> {
    const result = await session.run(`
        MATCH (c:Container)-[:CURRENT_STATE]->(s:ContainerState)
        RETURN s, c
    `);
    
    return result.records.map((record: Record) => {
        const s = record.get("s").properties;
        const c = record.get("c").properties;
        return {
            id: s.id,
            tenantId: s.tenantId,
            createdAt: new Date(s.createdAt),
            timestamp: new Date(s.timestamp),
            container: { ...c, createdAt: new Date(c.createdAt) } as Container,
            quantifiedComposition: {
                qty: neo4j.isInt(s.qty) ? s.qty.toBigInt() : BigInt(s.qty),
                unit: s.unit,
                attributes: deserializeAttributes(s.composition ?? "{}"),
            },
            flowsTo: [],
            flowsFrom: [],
        } as ContainerState;
    });
}

async function main() {
    const driver = getDriver();
    const session = driver.session();

    try {
        await cleanDb(session);
        await seedData(session);

        const NUM_OPERATIONS = 1000;
        console.log(`Generating ${NUM_OPERATIONS} synthetic operations...`);

        for (let i = 0; i < NUM_OPERATIONS; i++) {
            const headStates = await getAllHeadStates(session);
            const sources = headStates.filter(s => s.quantifiedComposition.qty > 0n);
            
            if (sources.length === 0) {
                console.log("No more source volume available!");
                break;
            }

            const source = sources[Math.floor(Math.random() * sources.length)];
            
            // Pick a destination that is NOT the source container
            const potentialDestinations = starterData.containers.filter(c => c.id !== source.container.id && c.type !== 'loss');
            const destinationContainer = potentialDestinations[Math.floor(Math.random() * potentialDestinations.length)];

            // Verify destination exists
            const destCheck = await session.run("MATCH (c:Container {id: $id}) RETURN c", { id: destinationContainer.id });
            if (destCheck.records.length === 0) {
                console.error(`Destination ${destinationContainer.id} NOT FOUND in DB!`);
                continue;
            }

            // Determine amount (10% to 50% of source)
            const pct = BigInt(Math.floor(Math.random() * 40) + 10);
            const amount = (source.quantifiedComposition.qty * pct) / 100n;

            if (amount === 0n) continue;

            console.log(`[${i+1}/${NUM_OPERATIONS}] Moving ${amount} from ${source.container.name} to ${destinationContainer.name}`);

            // Prepare inputs
            const inputs: ContainerState[] = [source];
            
            // Check if destination has a head state
            let destState = headStates.find(s => s.container.id === destinationContainer.id);
            
            if (!destState) {
                // Create dummy empty state
                destState = {
                    id: `dummy_empty_${destinationContainer.id}_${i}`,
                    container: destinationContainer,
                    quantifiedComposition: { qty: 0n, unit: "gal", attributes: {} },
                    flowsTo: [],
                    flowsFrom: [],
                    timestamp: new Date(),
                    tenantId: source.tenantId,
                    createdAt: new Date()
                } as ContainerState;

                // Save to DB so it can be referenced as input
                const stateRepo = new ContainerStateRepo(session);
                await stateRepo.create(destState);
            }
            
            inputs.push(destState);

            // Build operation
            const operation = await WineryOperationService.buildWineryOperation({
                id: uuidv4(),
                tenantId: source.tenantId,
                createdAt: new Date(),
                type: "transfer",
                description: `Synthetic transfer ${i+1}`,
                fromContainers: inputs,
                flowQuantities: [
                    {
                        fromStateId: source.id,
                        toStateId: destinationContainer.id, // Note: Service expects Container ID here based on my reading
                        qty: amount
                    }
                ]
            });

            // Commit
            await WineryOperationService.validateAndCommitOperation(operation);
        }
        
        console.log("Synthetic data generation complete!");

    } catch (error) {
        console.error("Error generating synthetic data:", error);
    } finally {
        await session.close();
        await driver.close();
    }
}

main();
