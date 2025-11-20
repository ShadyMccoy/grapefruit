// Test transfer operation for the "tiny tank" edge case.
import { WineryOperationService } from '../core/WineryOperationService';
import { getDriver } from '../db/client';
import { ContainerStateRepo } from '../db/repositories/ContainerStateRepo';
import { ContainerRepo } from '../db/repositories/ContainerRepo';
import { Container } from '../domain/nodes/Container';
import { ContainerState } from '../domain/nodes/ContainerState';

async function testTinyTankTransfer() {
  console.log('--- Running Tiny Tank Transfer Test ---');
  const driver = getDriver();
  const session = driver.session();

  try {
    // For a test, we clean up first to ensure a clean slate.
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('Cleaned database.');

    // Step 1: Ensure the containers exist
    const containerRepo = new ContainerRepo(session);
    const tankAInfo: Container = {
      id: 'tiny_tank_A',
      name: 'Tiny Tank A',
      capacityHUnits: 10,
      type: 'tank',
      tenantId: 'winery1',
      createdAt: new Date(),
    };
    await containerRepo.create(tankAInfo);

    const tankBInfo: Container = {
      id: 'tiny_tank_B',
      name: 'Tiny Tank B',
      capacityHUnits: 10,
      type: 'tank',
      tenantId: 'winery1',
      createdAt: new Date(),
    };
    await containerRepo.create(tankBInfo);
    console.log('Created tiny_tank_A and tiny_tank_B');

    // Step 2: Create the initial states for the operation
    const containerStateRepo = new ContainerStateRepo(session);
    const stateAInitial: ContainerState = {
      id: 'state_tiny_A_initial',
      container: tankAInfo,
      isHead: true,
      createdAt: new Date(),
      timestamp: new Date(),
      tenantId: 'winery1',
      quantifiedComposition: {
        qty: 2n,
        unit: 'gal',
        attributes: {
          varietal: {
            CHARD: 1n,
            PINOT: 1n,
          },
        },
      },
      flowsTo: [],
      flowsFrom: [],
    };
    await containerStateRepo.create(stateAInitial);

    const stateBInitial: ContainerState = {
      id: 'state_tiny_B_initial',
      container: tankBInfo,
      isHead: true,
      createdAt: new Date(),
      timestamp: new Date(),
      tenantId: 'winery1',
      quantifiedComposition: {
        qty: 0n,
        unit: 'gal',
        attributes: {},
      },
      flowsTo: [],
      flowsFrom: [],
    };
    await containerStateRepo.create(stateBInitial);
    console.log('Created initial states for tiny tanks.');

    // Step 3: Build the transfer operation using the service
    console.log('Building tiny tank transfer operation...');
    const operation = await WineryOperationService.buildWineryOperation({
      id: 'transfer_tiny_tank_001',
      type: 'transfer',
      description: 'Transfer 1 h-unit from Tiny Tank A to Tiny Tank B',
      tenantId: 'winery1',
      createdAt: new Date(),
      fromContainers: [stateAInitial, stateBInitial],
      flowQuantities: [
        { fromStateId: 'state_tiny_A_initial', toStateId: 'tiny_tank_B', qty: 1n },
      ],
    });

    // Step 4: Validate and commit the operation
    console.log('Committing tiny tank transfer operation...');
    const result = await WineryOperationService.validateAndCommitOperation(
      operation,
    );
    console.log('Tiny tank transfer operation created successfully.');

    // Step 5: Verify the output states
    if (result.outputStates && result.outputStates.length > 0) {
      const verificationSession = driver.session();
      const verificationRepo = new ContainerStateRepo(verificationSession);
      
      const finalStates = [];
      for (const outputState of result.outputStates) {
        finalStates.push(await verificationRepo.findById(outputState.id));
      }
      await verificationSession.close();

      console.log('\n--- Verification ---');
      console.log(
        'Final States:',
        JSON.stringify(finalStates, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2),
      );
    }
  } catch (error) {
    console.error('Tiny tank transfer operation failed:', error);
  } finally {
    await session.close();
    await driver.close();
    console.log('--- Test Complete ---');
  }
}

testTinyTankTransfer();
