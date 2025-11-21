
import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { WineryOperationService } from "../core/WineryOperationService";
import { ContainerState } from "../domain/nodes/ContainerState";
import { Container } from "../domain/nodes/Container";
import { v4 as uuidv4 } from 'uuid';
import neo4j, { Record } from "neo4j-driver";
import { deserializeAttributes } from "../util/attributeSerialization";
import { distributeComposition, blendCompositions } from "../core/CompositionHelpers";

// Configuration
const BATCH_SIZE = 100; // Log every N operations

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

async function getContainers(session: any): Promise<Container[]> {
    const result = await session.run(`MATCH (c:Container) RETURN c`);
    return result.records.map((r: Record) => {
        const c = r.get("c").properties;
        return { ...c, createdAt: new Date(c.createdAt) } as Container;
    });
}

async function main() {
    const args = process.argv.slice(2);
    const NUM_OPERATIONS = args.length > 0 ? parseInt(args[0]) : 100;
    
    console.log(`🚀 Starting Random Traffic Generator for ${NUM_OPERATIONS} operations...`);
    
    const driver = getDriver();
    const session = driver.session();

    try {
        // 1. Load Initial State
        console.log("📊 Loading initial state...");
        let headStates = await getAllHeadStates(session);
        const allContainers = await getContainers(session);
        
        const tanks = allContainers.filter(c => c.type === 'tank');
        const barrels = allContainers.filter(c => c.type === 'barrel');
        const gainNode = allContainers.find(c => c.type === 'gain') || await createSpecialNode(session, 'gain');
        const lossNode = allContainers.find(c => c.type === 'loss') || await createSpecialNode(session, 'loss');

        console.log(`   Found ${headStates.length} head states.`);
        console.log(`   Found ${tanks.length} tanks, ${barrels.length} barrels.`);

        const startTime = Date.now();

        for (let i = 0; i < NUM_OPERATIONS; i++) {
            // Refresh head states periodically (or track them locally? Tracking locally is hard with complex ops)
            // For correctness, let's fetch fresh head states for the involved containers.
            // But fetching ALL head states every time is slow.
            // Let's fetch ALL only periodically, or just query specifically.
            
            // Optimization: We need to pick a source.
            // We can keep a local list of "likely available" IDs, but we must verify qty.
            
            // For now, let's just filter the `headStates` array we have, and update it after op?
            // No, `WineryOperationService` creates new states.
            // We should re-fetch. To optimize, maybe we only fetch head states for the containers we picked?
            // But we need to pick a source with volume.
            
            // Strategy:
            // 1. Pick a random container from `allContainers`.
            // 2. Fetch its head state.
            // 3. If empty, try again (max retries).
            
            let sourceState: ContainerState | null = null;
            let retries = 0;
            while (!sourceState && retries < 10) {
                const candidate = allContainers[Math.floor(Math.random() * allContainers.length)];
                if (candidate.type === 'gain' || candidate.type === 'loss') continue;
                
                sourceState = await getHeadState(session, candidate.id);
                if (sourceState && sourceState.quantifiedComposition.qty <= 0n) {
                    sourceState = null; // Empty, try again
                }
                retries++;
            }

            if (!sourceState) {
                console.log("⚠️ Could not find a non-empty source after 10 tries. Skipping op.");
                continue;
            }

            // Pick Destination
            let destContainer: Container | null = null;
            retries = 0;
            while (!destContainer && retries < 10) {
                const candidate = allContainers[Math.floor(Math.random() * allContainers.length)];
                if (candidate.id !== sourceState.container.id && candidate.type !== 'gain' && candidate.type !== 'loss') {
                    destContainer = candidate;
                }
                retries++;
            }
            
            if (!destContainer) continue;

            // Fetch Dest State
            let destState = await getHeadState(session, destContainer.id);
            if (!destState) {
                // Create dummy empty state if not exists (shouldn't happen if seeded, but good for robustness)
                destState = await createEmptyState(session, destContainer);
            }

            // Determine Amount (10-50% of source)
            const pct = BigInt(Math.floor(Math.random() * 40) + 10);
            const transferQty = (sourceState.quantifiedComposition.qty * pct) / 100n;
            if (transferQty === 0n) continue;

            // Randomly decide on Pre-Gain / Post-Loss
            const hasPreGain = Math.random() < 0.2; // 20% chance
            const hasPostLoss = Math.random() < 0.2; // 20% chance

            const preGainQty = hasPreGain ? (transferQty * 5n) / 100n : 0n; // 5% gain
            const postLossQty = hasPostLoss ? (transferQty * 5n) / 100n : 0n; // 5% loss (positive number for calc)

            // Build Inputs/Outputs
            const inputs = [sourceState, destState];
            
            // If Post-Loss, we need a Loss Source (Negative Flow)
            // We need to calculate the blend to create the negative flow composition
            let lossSourceState: ContainerState | null = null;
            let lossFlowComp: any = null;

            if (hasPostLoss) {
                // Calculate ideal blend of what's going into Dest
                // Source contributes `transferQty`
                // Dest contributes `destState.qty`
                // Gain contributes `preGainQty` (negative flow from source to gain means source effectively had MORE)
                // Wait, Pre-Gain logic: A0 -> Gain (-1). A0 -> B (500).
                // The flow to B is just the transfer qty.
                
                // For Post-Loss (Spillage):
                // We need a negative flow into Dest.
                // Composition should be the blend of (Source + Dest).
                
                const flowFromSource = distributeComposition(sourceState.quantifiedComposition, [{ qty: transferQty, accepts: { physical: true, cost: true, value: true } }])[0];
                const flowFromDest = distributeComposition(destState.quantifiedComposition, [{ qty: destState.quantifiedComposition.qty, accepts: { physical: true, cost: true, value: true } }])[0];
                
                const idealBlend = blendCompositions([flowFromSource, flowFromDest]);
                
                // Create negative flow composition
                const lossQtyNeg = -postLossQty;
                // Scale it
                // We use the trick: distribute `idealBlend` into `lossQtyNeg` and `remainder`.
                const remainderQty = idealBlend.qty - lossQtyNeg;
                const dist = distributeComposition(idealBlend, [
                    { qty: lossQtyNeg, accepts: { physical: true, cost: true, value: true } },
                    { qty: remainderQty, accepts: { physical: true, cost: true, value: true } }
                ]);
                lossFlowComp = dist[0];

                lossSourceState = {
                    id: uuidv4(),
                    tenantId: sourceState.tenantId,
                    createdAt: new Date(),
                    container: lossNode,
                    quantifiedComposition: lossFlowComp,
                    timestamp: new Date(),
                    flowsTo: [],
                    flowsFrom: []
                } as ContainerState;
                
                inputs.push(lossSourceState);
            }

            // Build Flow Quantities
            const flowQuantities = [];
            
            // 1. Source -> Dest
            flowQuantities.push({
                fromStateId: sourceState.id,
                toStateId: destContainer.id,
                qty: transferQty
            });

            // 2. Source -> Gain (Pre-Gain) - Negative Flow
            if (hasPreGain) {
                flowQuantities.push({
                    fromStateId: sourceState.id,
                    toStateId: gainNode.id,
                    qty: -preGainQty
                });
            }

            // 3. LossSource -> Dest (Post-Loss) - Negative Flow
            if (hasPostLoss && lossSourceState) {
                flowQuantities.push({
                    fromStateId: lossSourceState.id,
                    toStateId: destContainer.id,
                    qty: -postLossQty // Negative
                });
            }

            // Build Operation
            const op = await WineryOperationService.buildWineryOperation({
                id: uuidv4(),
                tenantId: "winery1",
                createdAt: new Date(),
                type: "transfer",
                description: `Random Op ${i+1}: ${sourceState.container.name} -> ${destContainer.name} (Gain: ${hasPreGain}, Loss: ${hasPostLoss})`,
                fromContainers: inputs,
                flowQuantities: flowQuantities
            });

            // Commit
            await WineryOperationService.validateAndCommitOperation(op);

            if ((i + 1) % BATCH_SIZE === 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = (i + 1) / elapsed;
                console.log(`✅ Completed ${i + 1} operations. Rate: ${rate.toFixed(2)} ops/sec`);
            }
        }

        console.log(`\n🎉 Finished generating ${NUM_OPERATIONS} operations!`);

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await session.close();
        await driver.close();
    }
}

async function createSpecialNode(session: any, type: 'gain' | 'loss'): Promise<Container> {
    const repo = new ContainerRepo(session);
    const c: Container = {
        id: `${type}Node`,
        name: `${type.toUpperCase()} Node`,
        type: type,
        tenantId: "winery1",
        createdAt: new Date()
    };
    await repo.create(c);
    return c;
}

async function getHeadState(session: any, containerId: string): Promise<ContainerState | null> {
    const result = await session.run(`
        MATCH (c:Container {id: $id})-[:CURRENT_STATE]->(s:ContainerState)
        RETURN s, c
    `, { id: containerId });
    
    if (result.records.length === 0) return null;
    
    const s = result.records[0].get("s").properties;
    const c = result.records[0].get("c").properties;
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
}

async function createEmptyState(session: any, container: Container): Promise<ContainerState> {
    const stateRepo = new ContainerStateRepo(session);
    const s: ContainerState = {
        id: uuidv4(),
        tenantId: container.tenantId,
        createdAt: new Date(),
        container: container,
        quantifiedComposition: { qty: 0n, unit: "gal", attributes: {} },
        timestamp: new Date(),
        flowsTo: [],
        flowsFrom: []
    };
    await stateRepo.create(s);
    return s;
}

main();
