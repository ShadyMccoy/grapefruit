
import { v4 as uuidv4 } from 'uuid';
import { getDriver } from '../db/client';
import { ContainerRepo } from '../db/repositories/ContainerRepo';
import { ContainerStateRepo } from '../db/repositories/ContainerStateRepo';
import { WineryOperationService } from '../core/WineryOperationService';
import { ContainerState } from '../domain/nodes/ContainerState';
import { Container } from '../domain/nodes/Container';
import { distributeInteger } from '../core/CompositionHelpers';
import neo4j from 'neo4j-driver';

async function main() {
    const driver = getDriver();
    const session = driver.session();

    try {
        console.log("--- Setting up Topping Scenario (Barrel Group) ---");
        
        const cRepo = new ContainerRepo(session);
        const sRepo = new ContainerStateRepo(session);

        // 1. Create Source Tank (Topping Wine)
        const tankId = uuidv4();
        const tank: Container = {
            id: tankId,
            name: "Topping Tank",
            type: "tank",
            capacityHUnits: 100000000n, // 10,000 gal
            tenantId: "tenant-1",
            createdAt: new Date()
        };
        
        let tankState: ContainerState = {
            id: uuidv4(),
            tenantId: "tenant-1",
            createdAt: new Date(),
            container: tank,
            quantifiedComposition: {
                qty: 5000000n, // 500 gal
                unit: "gal",
                attributes: {
                    varietal: { "Topping Blend": 5000000n },
                    vintage: { "2023": 5000000n },
                    county: { "Napa": 5000000n },
                    state: { "CA": 5000000n },
                    ava: { "Napa Valley": 5000000n },
                    realDollars: 2500000n, // $5/gal
                    nominalDollars: 2500000n
                }
            },
            timestamp: new Date(),
            flowsTo: [],
            flowsFrom: []
        };

        // 2. Create Barrel Group (Virtual Tank)
        const BARREL_COUNT = 100;
        const BARREL_CAPACITY = 600000n; // 60 gal
        const GROUP_CAPACITY = BigInt(BARREL_COUNT) * BARREL_CAPACITY; // 6000 gal

        const groupId = uuidv4();
        const group: Container = {
            id: groupId,
            name: "Barrel Group 101",
            type: "barrel-group",
            capacityHUnits: GROUP_CAPACITY,
            tenantId: "tenant-1",
            createdAt: new Date()
        };

        let groupState: ContainerState = {
            id: uuidv4(),
            tenantId: "tenant-1",
            createdAt: new Date(),
            container: group,
            quantifiedComposition: {
                qty: GROUP_CAPACITY, // Full
                unit: "gal",
                attributes: {
                    varietal: { "Cabernet": GROUP_CAPACITY },
                    vintage: { "2022": GROUP_CAPACITY },
                    county: { "Sonoma": GROUP_CAPACITY },
                    state: { "CA": GROUP_CAPACITY },
                    ava: { "Sonoma Valley": GROUP_CAPACITY },
                    realDollars: GROUP_CAPACITY * 10n, // $10/gal
                    nominalDollars: GROUP_CAPACITY * 10n
                }
            },
            timestamp: new Date(),
            flowsTo: [],
            flowsFrom: []
        };

        // 3. Create Physical Barrels and Link to Group
        // These do NOT have states. They are just members.
        console.log(`Creating ${BARREL_COUNT} physical barrels...`);
        await cRepo.create(tank);
        await sRepo.create(tankState);
        await cRepo.create(group);
        await sRepo.create(groupState);

        for (let i = 0; i < BARREL_COUNT; i++) {
            const bId = uuidv4();
            const barrel: Container = {
                id: bId,
                name: `B-${i+1}`,
                type: "barrel",
                capacityHUnits: BARREL_CAPACITY,
                tenantId: "tenant-1",
                createdAt: new Date()
            };
            await cRepo.create(barrel);
            await cRepo.addBarrelToGroup(barrel.id, group.id);
        }

        // 4. Create Loss Container
        const lossId = uuidv4();
        const lossContainer: Container = {
            id: lossId,
            name: "Evaporation Loss",
            type: "loss",
            tenantId: "tenant-1",
            createdAt: new Date()
        };
        
        let lossState: ContainerState = {
            id: uuidv4(),
            tenantId: "tenant-1",
            createdAt: new Date(),
            container: lossContainer,
            quantifiedComposition: { qty: 0n, unit: "gal", attributes: {} },
            timestamp: new Date(),
            flowsTo: [],
            flowsFrom: []
        };
        await cRepo.create(lossContainer);
        await sRepo.create(lossState);

        console.log("Setup complete. 1 Tank, 1 Group (100 Barrels), 1 Loss Node.");

        // --- Perform Topping Loop ---
        // Logic: 
        // Total Evaporation = 0.5 gal * 100 = 50 gal.
        // We top 50 gal from Tank -> Group.
        // We record 50 gal Loss from Group -> Loss.
        
        const TOPPING_QTY = 500000n; // 50 gal
        const ITERATIONS = 10;
        const timings: number[] = [];
        let lastResult: any = null;

        for (let iter = 0; iter < ITERATIONS; iter++) {
            const iterStart = Date.now();
            
            // Flows:
            // 1. Group -> Loss (Evaporation)
            // 2. Tank -> Group (Refill)
            // 3. Group -> Group (Remainder - Auto)
            
            const flowQuantities = [
                {
                    fromStateId: groupState.id,
                    toStateId: lossContainer.id,
                    qty: TOPPING_QTY
                },
                {
                    fromStateId: tankState.id,
                    toStateId: group.id,
                    qty: TOPPING_QTY
                }
            ];

            const op = await WineryOperationService.buildWineryOperation({
                id: uuidv4(),
                tenantId: "tenant-1",
                createdAt: new Date(),
                type: "topping",
                description: `Top Group - Iteration ${iter + 1}`,
                fromContainers: [tankState, groupState, lossState],
                flowQuantities: flowQuantities
            });

            const result = await WineryOperationService.validateAndCommitOperation(op);
            lastResult = result;

            // Update States for next iteration
            const newTankState = result.outputStates?.find(s => s.container.id === tank.id);
            if (newTankState) tankState = newTankState;

            const newGroupState = result.outputStates?.find(s => s.container.id === group.id);
            if (newGroupState) groupState = newGroupState;

            const newLossState = result.outputStates?.find(s => s.container.id === lossContainer.id);
            if (newLossState) lossState = newLossState;
            
            const iterEnd = Date.now();
            const duration = iterEnd - iterStart;
            timings.push(duration);
            console.log(`Iteration ${iter + 1} complete in ${duration}ms`);
        }

        const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
        console.log(`Average Time per Iteration: ${avgTime.toFixed(2)}ms`);
        console.log(`Total Time for ${ITERATIONS} iterations: ${timings.reduce((a, b) => a + b, 0)}ms`);

        // --- Verification ---
        const result = lastResult;
        
        // 1. Check Tank
        const outTank = result.outputStates?.find((s: ContainerState) => s.container.id === tank.id);
        const expectedTankQty = 5000000n - (TOPPING_QTY * BigInt(ITERATIONS)); 
        console.log(`Tank Qty: ${outTank?.quantifiedComposition.qty} (Expected ${expectedTankQty})`);

        // 2. Check Loss
        const outLoss = result.outputStates?.find((s: ContainerState) => s.container.id === lossContainer.id);
        const expectedLossQty = TOPPING_QTY * BigInt(ITERATIONS);
        console.log(`Loss Qty: ${outLoss?.quantifiedComposition.qty} (Expected ${expectedLossQty})`);

        // 3. Check Group
        const outGroup = result.outputStates?.find((s: ContainerState) => s.container.id === group.id);
        console.log(`Group Qty: ${outGroup?.quantifiedComposition.qty} (Expected ${GROUP_CAPACITY})`);
        
        console.log("Group Composition Sample:");
        console.log(JSON.stringify(outGroup?.quantifiedComposition.attributes, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

        // 4. Verify Snapshotting
        // Check if the final group state has 100 snapshot members
        const snapshotResult = await session.run(
            `
            MATCH (b:Container)-[:SNAPSHOT_MEMBER_OF]->(s:ContainerState {id: $stateId})
            RETURN count(b) as count
            `,
            { stateId: outGroup?.id }
        );
        const count = snapshotResult.records[0].get("count").toNumber();
        console.log(`Final Group State has ${count} snapshot members (Expected ${BARREL_COUNT}).`);

    } catch (e) {
        console.error(e);
    } finally {
        await session.close();
        await driver.close();
    }
}

main();
