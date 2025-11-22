import { v4 as uuidv4 } from 'uuid';
import { getDriver } from '../db/client';
import { WeighTagRepo } from '../db/repositories/WeighTagRepo';
import { ContainerRepo } from '../db/repositories/ContainerRepo';
import { WineryOperationService } from '../core/WineryOperationService';
import { WeighTag } from '../domain/nodes/VocabNodes';
import { Container } from '../domain/nodes/Container';
import { ContainerState } from '../domain/nodes/ContainerState';
import { deserializeAttributes, serializeAttributes } from '../util/attributeSerialization';

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log("=== Scenario 1: 1 WeighTag -> 1 Empty Tank ===");
    await runScenario1(session);

    console.log("\n=== Scenario 2: 1 WeighTag -> Tank with Qty ===");
    await runScenario2(session);

    console.log("\n=== Scenario 3: 2 WeighTags -> Tank with Qty ===");
    await runScenario3(session);

    console.log("\n=== Scenario 4: Partial WeighTag -> Empty Tank ===");
    await runScenario4(session);

    console.log("\n=== Scenario 5: Tank with Qty + 2 WeighTags (1 Partial) -> Tank ===");
    await runScenario5(session);

    console.log("\n=== Scenario 6: 2 Tanks + 3 WeighTags (1 Partial) -> 2 Tanks ===");
    await runScenario6(session);

  } catch (e) {
    console.error(e);
  } finally {
    await session.close();
    await driver.close();
  }
}

async function createWeighTag(session: any, lbs: bigint, varietal: string, cost: bigint = 1000n, value: bigint = 2000n): Promise<{ weighTag: WeighTag, state: ContainerState }> {
    const id = uuidv4();
    const wt: WeighTag = {
        id,
        tagNumber: `WT-${id.substring(0, 8)}`,
        name: `WT-${id.substring(0, 8)}`,
        type: 'weighTag',
        capacityHUnits: lbs,
        weightLbs: Number(lbs),
        vintage: 2023,
        tenantId: "tenant-1",
        createdAt: new Date(),
        quantifiedComposition: {
            qty: lbs,
            unit: "lbs",
            attributes: { 
                varietal: { [varietal]: lbs },
                vintage: { "2023": lbs },
                ava: { "Napa Valley": lbs, "North Coast": lbs },
                county: { "Napa": lbs },
                state: { "CA": lbs },
                realDollars: cost,
                nominalDollars: value
            }
        }
    };
    await new WeighTagRepo(session).create(wt);
    
    // Fetch the state created by the repo
    const result = await session.run(`
        MATCH (w:WeighTag {id: $id})-[:CURRENT_STATE]->(s:ContainerState)
        RETURN s
    `, { id });
    
    const s = result.records[0].get('s').properties;

    const state: ContainerState = {
        id: s.id,
        tenantId: s.tenantId,
        createdAt: new Date(s.createdAt),
        container: wt,
        quantifiedComposition: {
            qty: BigInt(s.qty),
            unit: s.unit,
            attributes: deserializeAttributes(s.composition || '{}')
        },
        timestamp: new Date(s.createdAt),
        flowsTo: [],
        flowsFrom: []
    };
    
    return { weighTag: wt, state };
}

async function createTank(session: any, name: string, initialQty: bigint = 0n): Promise<{ container: Container, state: ContainerState }> {
    const id = uuidv4();
    const tank: Container = {
        id,
        name,
        type: "tank",
        capacityHUnits: 10000n,
        tenantId: "tenant-1",
        createdAt: new Date()
    };
    await new ContainerRepo(session).create(tank);

    const stateId = uuidv4();
    const composition: any = initialQty > 0n ? { 
        varietal: { "Existing Wine": initialQty },
        vintage: { "2022": initialQty },
        ava: { "Sonoma Valley": initialQty },
        county: { "Sonoma": initialQty },
        state: { "CA": initialQty },
        realDollars: 100n,
        nominalDollars: 100n
    } : {};
    
    await session.run(`
        MATCH (c:Container {id: $tankId})
        CREATE (s:ContainerState {
            id: $stateId,
            qty: $qty,
            unit: 'gal',
            composition: $comp,
            tenantId: $tenantId,
            createdAt: datetime()
        })
        CREATE (c)-[:CURRENT_STATE]->(s)
    `, { 
        tankId: id, 
        stateId, 
        qty: initialQty, 
        comp: serializeAttributes(composition),
        tenantId: "tenant-1" 
    });

    const state: ContainerState = {
        id: stateId,
        tenantId: "tenant-1",
        createdAt: new Date(),
        container: tank,
        quantifiedComposition: {
            qty: initialQty,
            unit: 'gal',
            attributes: composition
        },
        timestamp: new Date(),
        flowsTo: [],
        flowsFrom: []
    };

    return { container: tank, state };
}

async function runScenario1(session: any) {
    const { state: wtState } = await createWeighTag(session, 2000n, "Cabernet");
    const { container: tank, state: tankState } = await createTank(session, "S1-Tank");

    const op = await WineryOperationService.buildWineryOperation({
        id: uuidv4(),
        tenantId: "tenant-1",
        createdAt: new Date(),
        type: "press",
        description: "S1: 1 WT -> 1 Tank",
        fromContainers: [wtState, tankState],
        flowQuantities: [],
        targetFlowQuantities: [
            { containerId: tank.id, qty: 150n, unit: 'gal' }
        ],
        inputConsumption: [
            { stateId: wtState.id, qty: 2000n } // Consume full weigh tag
        ]
    });

    const result = await WineryOperationService.validateAndCommitOperation(op);
    const outTank = result.outputStates?.find(s => s.container.id === tank.id);
    console.log(`  Tank Qty: ${outTank?.quantifiedComposition.qty} gal (Expected 150)`);
    console.log(`  Tank Comp: ${JSON.stringify(outTank?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
}

async function runScenario2(session: any) {
    const { state: wtState } = await createWeighTag(session, 2000n, "Merlot");
    const { container: tank, state: tankState } = await createTank(session, "S2-Tank", 100n); // 100 gal existing

    const op = await WineryOperationService.buildWineryOperation({
        id: uuidv4(),
        tenantId: "tenant-1",
        createdAt: new Date(),
        type: "press",
        description: "S2: 1 WT -> Tank w/ Qty",
        fromContainers: [wtState, tankState],
        flowQuantities: [],
        targetFlowQuantities: [
            { containerId: tank.id, qty: 150n, unit: 'gal' }
        ],
        inputConsumption: [
            { stateId: wtState.id, qty: 2000n }
        ]
    });

    const result = await WineryOperationService.validateAndCommitOperation(op);
    const outTank = result.outputStates?.find(s => s.container.id === tank.id);
    console.log(`  Tank Qty: ${outTank?.quantifiedComposition.qty} gal (Expected 250)`);
    console.log(`  Tank Comp: ${JSON.stringify(outTank?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
}

async function runScenario3(session: any) {
    const { state: wt1 } = await createWeighTag(session, 2000n, "Pinot");
    const { state: wt2 } = await createWeighTag(session, 2000n, "Pinot");
    const { container: tank, state: tankState } = await createTank(session, "S3-Tank", 100n);

    const op = await WineryOperationService.buildWineryOperation({
        id: uuidv4(),
        tenantId: "tenant-1",
        createdAt: new Date(),
        type: "press",
        description: "S3: 2 WT -> Tank w/ Qty",
        fromContainers: [wt1, wt2, tankState],
        flowQuantities: [],
        targetFlowQuantities: [
            { containerId: tank.id, qty: 300n, unit: 'gal' }
        ],
        inputConsumption: [
            { stateId: wt1.id, qty: 2000n },
            { stateId: wt2.id, qty: 2000n }
        ]
    });

    const result = await WineryOperationService.validateAndCommitOperation(op);
    const outTank = result.outputStates?.find(s => s.container.id === tank.id);
    console.log(`  Tank Qty: ${outTank?.quantifiedComposition.qty} gal (Expected 400)`);
    console.log(`  Tank Comp: ${JSON.stringify(outTank?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
}

async function runScenario4(session: any) {
    const { state: wtState } = await createWeighTag(session, 2000n, "Zinfandel");
    const { container: tank, state: tankState } = await createTank(session, "S4-Tank");

    // Press 1000 lbs (50%) -> 75 gal
    const op = await WineryOperationService.buildWineryOperation({
        id: uuidv4(),
        tenantId: "tenant-1",
        createdAt: new Date(),
        type: "press",
        description: "S4: Partial WT -> Tank",
        fromContainers: [wtState, tankState],
        flowQuantities: [],
        targetFlowQuantities: [
            { containerId: tank.id, qty: 75n, unit: 'gal' }
        ],
        inputConsumption: [
            { stateId: wtState.id, qty: 1000n }
        ]
    });

    const result = await WineryOperationService.validateAndCommitOperation(op);
    
    const outTank = result.outputStates?.find(s => s.container.id === tank.id);
    const outWt = result.outputStates?.find(s => s.container.id === wtState.container.id);

    console.log(`  Tank Qty: ${outTank?.quantifiedComposition.qty} gal (Expected 75)`);
    console.log(`  Tank Comp: ${JSON.stringify(outTank?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
    
    console.log(`  WT Remainder Qty: ${outWt?.quantifiedComposition.qty} lbs (Expected 1000)`);
    console.log(`  WT Remainder Comp: ${JSON.stringify(outWt?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
}

async function runScenario5(session: any) {
    const { state: wt1 } = await createWeighTag(session, 2000n, "Merlot");
    const { state: wt2 } = await createWeighTag(session, 2000n, "Cabernet");
    const { container: tank, state: tankState } = await createTank(session, "S5-Tank", 100n);

    // Press WT1 (Full) + WT2 (Partial 1000 lbs) -> Tank
    // WT1 -> 150 gal
    // WT2 -> 75 gal
    // Tank -> 100 + 150 + 75 = 325 gal
    
    const op = await WineryOperationService.buildWineryOperation({
        id: uuidv4(),
        tenantId: "tenant-1",
        createdAt: new Date(),
        type: "press",
        description: "S5: Mix Press",
        fromContainers: [wt1, wt2, tankState],
        flowQuantities: [],
        targetFlowQuantities: [
            { containerId: tank.id, qty: 225n, unit: 'gal' }
        ],
        inputConsumption: [
            { stateId: wt1.id, qty: 2000n },
            { stateId: wt2.id, qty: 1000n }
        ]
    });

    const result = await WineryOperationService.validateAndCommitOperation(op);
    const outTank = result.outputStates?.find(s => s.container.id === tank.id);
    const outWt2 = result.outputStates?.find(s => s.container.id === wt2.container.id);

    console.log(`  Tank Qty: ${outTank?.quantifiedComposition.qty} gal (Expected 325)`);
    console.log(`  Tank Comp: ${JSON.stringify(outTank?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
    console.log(`  WT2 Remainder: ${outWt2?.quantifiedComposition.qty} lbs (Expected 1000)`);
    console.log(`  WT2 Remainder Comp: ${JSON.stringify(outWt2?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
}
async function runScenario6(session: any) {
    const { state: wt1 } = await createWeighTag(session, 2000n, "WT1");
    const { state: wt2 } = await createWeighTag(session, 2000n, "WT2");
    const { state: wt3 } = await createWeighTag(session, 2000n, "WT3");
    const { container: tankA, state: tankAState } = await createTank(session, "S6-TankA", 0n);
    const { container: tankB, state: tankBState } = await createTank(session, "S6-TankB", 100n);

    // WT1 (2000 pounds = 160 gal)
    // WT2 (2000n pounds = 160 gal)
    // WT3 (Partial 1000 pounds = 80 gal)
    // 400 gallons pressed total
    // 100 gal to TankA
    // 300 gal to TankB  
    
    const op = await WineryOperationService.buildWineryOperation({
        id: uuidv4(),
        tenantId: "tenant-1",
        createdAt: new Date(),
        type: "press",
        description: "S6: Complex Multi-Press",
        fromContainers: [wt1, wt2, wt3, tankAState, tankBState],
        flowQuantities: [], // Empty, let system generate
        targetFlowQuantities: [
            { containerId: tankA.id, qty: 300n, unit: 'gal' },
            { containerId: tankB.id, qty: 100n, unit: 'gal' }
        ],
        inputConsumption: [
            { stateId: wt1.id, qty: 2000n },
            { stateId: wt2.id, qty: 2000n },
            { stateId: wt3.id, qty: 1000n }
        ]
    });

    const result = await WineryOperationService.validateAndCommitOperation(op);
    const outTankA = result.outputStates?.find(s => s.container.id === tankA.id);
    const outTankB = result.outputStates?.find(s => s.container.id === tankB.id);
    const outWt3 = result.outputStates?.find(s => s.container.id === wt3.container.id);

    console.log(`  TankA Qty: ${outTankA?.quantifiedComposition.qty} gal (Expected 300)`);
    console.log(`  TankA Comp: ${JSON.stringify(outTankA?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
    console.log(`  TankB Qty: ${outTankB?.quantifiedComposition.qty} gal (Expected 200)`);
    console.log(`  TankB Comp: ${JSON.stringify(outTankB?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
    console.log(`  WT3 Remainder: ${outWt3?.quantifiedComposition.qty} lbs (Expected 1000)`);
    console.log(`  WT3 Remainder Comp: ${JSON.stringify(outWt3?.quantifiedComposition.attributes, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
}

main();
