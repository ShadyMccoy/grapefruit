
import { v4 as uuidv4 } from 'uuid';
import { getDriver } from '../db/client';
import { ContainerRepo } from '../db/repositories/ContainerRepo';
import { ContainerStateRepo } from '../db/repositories/ContainerStateRepo';
import { WineryOperationService } from '../core/WineryOperationService';
import { ContainerState } from '../domain/nodes/ContainerState';
import { Container } from '../domain/nodes/Container';
import neo4j from 'neo4j-driver';

async function main() {
    const driver = getDriver();
    const session = driver.session();

    try {
        console.log("--- Setting up Barrel Group Scenario ---");
        
        const cRepo = new ContainerRepo(session);
        const sRepo = new ContainerStateRepo(session);

        // 1. Create Virtual Tank (Barrel Group)
        const groupId = uuidv4();
        const group: Container = {
            id: groupId,
            name: "Barrel Group A",
            type: "barrel-group",
            capacityHUnits: 6000000n, // 600 gal (10 barrels)
            tenantId: "tenant-1",
            createdAt: new Date()
        };
        
        // Initial State (Empty)
        const groupState: ContainerState = {
            id: uuidv4(),
            tenantId: "tenant-1",
            createdAt: new Date(),
            container: group,
            quantifiedComposition: { qty: 0n, unit: "gal", attributes: {} },
            timestamp: new Date(),
            flowsTo: [],
            flowsFrom: []
        };

        await cRepo.create(group);
        await sRepo.create(groupState);

        // 2. Create 10 Physical Barrels and Add to Group
        console.log("Creating 10 barrels and adding to group...");
        const barrels: Container[] = [];
        for (let i = 0; i < 10; i++) {
            const bId = uuidv4();
            const barrel: Container = {
                id: bId,
                name: `Phys-Barrel-${i+1}`,
                type: "barrel",
                capacityHUnits: 600000n, // 60 gal
                tenantId: "tenant-1",
                createdAt: new Date()
            };
            await cRepo.create(barrel);
            await cRepo.addBarrelToGroup(barrel.id, group.id);
            barrels.push(barrel);
        }

        // 3. Create Source Tank (To Fill Group)
        const tankId = uuidv4();
        const tank: Container = {
            id: tankId,
            name: "Source Tank",
            type: "tank",
            capacityHUnits: 10000000n,
            tenantId: "tenant-1",
            createdAt: new Date()
        };
        const tankState: ContainerState = {
            id: uuidv4(),
            tenantId: "tenant-1",
            createdAt: new Date(),
            container: tank,
            quantifiedComposition: {
                qty: 1000000n, // 100 gal
                unit: "gal",
                attributes: { varietal: { "Merlot": 1000000n } }
            },
            timestamp: new Date(),
            flowsTo: [],
            flowsFrom: []
        };
        await cRepo.create(tank);
        await sRepo.create(tankState);

        // 4. Perform Fill Operation (Tank -> Group)
        console.log("Performing Fill Operation...");
        const op = await WineryOperationService.buildWineryOperation({
            id: uuidv4(),
            tenantId: "tenant-1",
            createdAt: new Date(),
            type: "transfer",
            description: "Fill Barrel Group",
            fromContainers: [tankState, groupState],
            flowQuantities: [{
                fromStateId: tankState.id,
                toStateId: group.id,
                qty: 500000n // 50 gal
            }]
        });

        const result = await WineryOperationService.validateAndCommitOperation(op);
        
        // 5. Verify Snapshot
        console.log("Verifying Snapshot Relationships...");
        const outGroupState = result.outputStates?.find(s => s.container.id === group.id);
        if (!outGroupState) throw new Error("Output state not found");

        const snapshotResult = await session.run(
            `
            MATCH (b:Container)-[:SNAPSHOT_MEMBER_OF]->(s:ContainerState {id: $stateId})
            RETURN count(b) as count, collect(b.name) as names
            `,
            { stateId: outGroupState.id }
        );

        const count = snapshotResult.records[0].get("count").toNumber();
        const names = snapshotResult.records[0].get("names");
        
        console.log(`Snapshot contains ${count} barrels.`);
        console.log(`Names: ${names.join(", ")}`);

        if (count !== 10) {
            throw new Error(`Expected 10 barrels in snapshot, found ${count}`);
        }

        // 6. Modify Group (Remove 1 Barrel)
        console.log("Removing 1 barrel from group...");
        await cRepo.removeBarrelFromGroup(barrels[0].id, group.id);

        // 7. Perform another operation (Top up)
        console.log("Performing Top Up...");
        // Need to refresh state
        const refreshedGroupState = outGroupState; // In real app, would fetch fresh
        // Actually, we need to fetch the fresh state to be safe, but here we know it's the head.
        // However, we need to construct a new operation.
        
        // We need the NEW tank state too.
        const outTankState = result.outputStates?.find(s => s.container.id === tank.id);
        if (!outTankState) throw new Error("Tank state lost");

        const op2 = await WineryOperationService.buildWineryOperation({
            id: uuidv4(),
            tenantId: "tenant-1",
            createdAt: new Date(),
            type: "transfer",
            description: "Top Up Group",
            fromContainers: [outTankState, refreshedGroupState],
            flowQuantities: [{
                fromStateId: outTankState.id,
                toStateId: group.id,
                qty: 10000n // 1 gal
            }]
        });

        const result2 = await WineryOperationService.validateAndCommitOperation(op2);
        const outGroupState2 = result2.outputStates?.find(s => s.container.id === group.id);

        // 8. Verify Second Snapshot (Should have 9 barrels)
        const snapshotResult2 = await session.run(
            `
            MATCH (b:Container)-[:SNAPSHOT_MEMBER_OF]->(s:ContainerState {id: $stateId})
            RETURN count(b) as count
            `,
            { stateId: outGroupState2?.id }
        );
        const count2 = snapshotResult2.records[0].get("count").toNumber();
        console.log(`Second Snapshot contains ${count2} barrels (Expected 9).`);

        if (count2 !== 9) {
            throw new Error(`Expected 9 barrels in snapshot, found ${count2}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await session.close();
        await driver.close();
    }
}

main();
