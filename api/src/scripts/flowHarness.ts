import { Container } from "../domain/nodes/Container";
import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { generateTransferFlows } from "../core/CompositionHelpers";

interface CompositionScenario {
  name: string;
  inputStates: ContainerState[];
  flows?: FlowToRelationship[]; // Optional: can be generated
  expectedCompositions: ContainerState[];
  operation?: (inputs: ContainerState[]) => FlowToRelationship[]; // Optional: generate flows from inputs
}

const HARNESS_TENANT = "harness_tenant";
const ZERO_TIME = new Date("2000-01-01T00:00:00.000Z");

const scenarios: CompositionScenario[] = [
  buildDirectTransferScenario2(),
  buildGeneratedTransferScenario()
];

runHarness(scenarios).catch((error) => {
  console.error("Flow harness failed", error);
  process.exit(1);
});

async function runHarness(tests: CompositionScenario[]) {
  for (const scenario of tests) {
    console.log(`\nRunning scenario: ${scenario.name}`);
    
    // Generate flows if operation function provided
    const flows = scenario.flows ?? scenario.operation?.(scenario.inputStates) ?? [];
    const scenarioWithFlows = { ...scenario, flows };
    
    validateScenarioConnectivity(scenarioWithFlows);
    validateConservation(scenarioWithFlows);
    const computedStates = computeOutputStates(scenarioWithFlows);
    assertStatesMatch(scenarioWithFlows.expectedCompositions, computedStates);
    console.log(`Scenario \"${scenario.name}\" passed.`);
  }
}

// Intent: Ensure flows reference known states before we trust the math.
function validateScenarioConnectivity(scenario: CompositionScenario & { flows: FlowToRelationship[] }) {
  const knownStateIds = new Set<string>([
    ...scenario.inputStates.map((state) => state.id),
    ...scenario.expectedCompositions.map((state) => state.id),
  ]);

  for (const flow of scenario.flows) {
    if (!knownStateIds.has(flow.from.id)) {
      throw new Error(
        `Flow from ${flow.from.id} is not declared in inputs or expected outputs.`
      );
    }
    if (!knownStateIds.has(flow.to.id)) {
      throw new Error(
        `Flow to ${flow.to.id} is not declared in inputs or expected outputs.`
      );
    }
  }
}

// Intent: Enforce quantity and composition conservation per input state (net flows sum to zero).
function validateConservation(scenario: CompositionScenario & { flows: FlowToRelationship[] }) {
  const flowsByFrom = scenario.flows.reduce<Map<string, FlowToRelationship[]>>(
    (map, flow) => {
      const bucket = map.get(flow.from.id) ?? [];
      bucket.push(flow);
      map.set(flow.from.id, bucket);
      return map;
    },
    new Map()
  );

  for (const inputState of scenario.inputStates) {
    const flows = flowsByFrom.get(inputState.id) || [];
    let netQty = 0;
    const netComposition: Partial<QuantifiedComposition> = {
      varietals: {},
      realDollars: 0,
      nominalDollars: 0,
    };

    for (const flow of flows) {
      netQty += flow.properties.qty;
      mergeComposition(netComposition, flow.properties);
    }

    assertZeroNumber(`net qty for ${inputState.id}`, netQty);
    assertCompositionZero(`net composition for ${inputState.id}`, netComposition);
  }
}

function assertCompositionEqual(
  label: string,
  actual: Partial<QuantifiedComposition>,
  expected: Partial<QuantifiedComposition>
) {
  const actualVarietals = actual.varietals ?? {};
  const expectedVarietals = expected.varietals ?? {};
  const varietalKeys = new Set([
    ...Object.keys(actualVarietals),
    ...Object.keys(expectedVarietals),
  ]);

  for (const key of varietalKeys) {
    assertNumberEqual(
      `${label} varietal ${key}`,
      actualVarietals[key] || 0,
      expectedVarietals[key] || 0
    );
  }

  assertNumberEqual(
    `${label} real dollars`,
    actual.realDollars ?? 0,
    expected.realDollars ?? 0
  );
  assertNumberEqual(
    `${label} nominal dollars`,
    actual.nominalDollars ?? 0,
    expected.nominalDollars ?? 0
  );
}

function assertCompositionZero(label: string, composition: Partial<QuantifiedComposition>) {
  const varietals = composition.varietals ?? {};
  for (const [key, amount] of Object.entries(varietals)) {
    assertZeroNumber(`${label} varietal ${key}`, amount);
  }
  assertZeroNumber(`${label} real dollars`, composition.realDollars ?? 0);
  assertZeroNumber(`${label} nominal dollars`, composition.nominalDollars ?? 0);
}

function assertNumberEqual(label: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertZeroNumber(label: string, value: number) {
  if (value !== 0) {
    throw new Error(`${label}: expected 0, received ${value}`);
  }
}

// Intent: Aggregate flows into deterministic state projections for comparison.
function computeOutputStates(scenario: CompositionScenario & { flows: FlowToRelationship[] }): ContainerState[] {
  const inputsByContainer = new Map<string, ContainerState>();
  for (const input of scenario.inputStates) {
    inputsByContainer.set(input.container.id, input);
  }

  const result = new Map<string, ContainerState>();

  for (const flow of scenario.flows) {
    const targetId = flow.to.id;
    let shell = result.get(targetId);
    if (!shell) {
      shell = createOutputShell(targetId, scenario, flow);
      const input = inputsByContainer.get(shell.container.id);
      if (input) {
        shell.quantifiedComposition.qty = input.quantifiedComposition.qty;
        shell.quantifiedComposition.varietals = { ...input.quantifiedComposition.varietals };
        shell.quantifiedComposition.realDollars = input.quantifiedComposition.realDollars;
        shell.quantifiedComposition.nominalDollars = input.quantifiedComposition.nominalDollars;
      }
      result.set(targetId, shell);
    }
    shell.quantifiedComposition.qty += flow.properties.qty;
    shell.quantifiedComposition.unit = flow.properties.unit;
    mergeComposition(shell.quantifiedComposition, flow.properties);
  }

  return Array.from(result.values());
}

function createOutputShell(
  stateId: string,
  scenario: CompositionScenario,
  flow: FlowToRelationship
): ContainerState {
  const template =
    scenario.expectedCompositions.find((state) => state.id === stateId) ??
    scenario.inputStates.find((state) => state.id === stateId);

  const container: Container = template?.container ?? {
    id: `${stateId}_container`,
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    name: `${stateId}_container`,
    type: "tank",
  };

  return {
    id: stateId,
    tenantId: template?.tenantId ?? HARNESS_TENANT,
    createdAt: template?.createdAt ?? ZERO_TIME,
    container,
    quantifiedComposition: {
      qty: 0,
      unit: template?.quantifiedComposition?.unit ?? flow.properties.unit,
      varietals: {},
      realDollars: 0,
      nominalDollars: 0
    },
    timestamp: template?.timestamp ?? ZERO_TIME,
  };
}

function mergeComposition(target: Partial<QuantifiedComposition>, delta?: Partial<QuantifiedComposition>) {
  if (!delta) return;

  if (delta.varietals) {
    target.varietals = target.varietals ?? {};
    for (const [varietal, amount] of Object.entries(delta.varietals)) {
      target.varietals[varietal] = (target.varietals[varietal] || 0) + amount;
    }
  }

  if (delta.realDollars !== undefined) {
    target.realDollars = (target.realDollars ?? 0) + delta.realDollars;
  }

  if (delta.nominalDollars !== undefined) {
    target.nominalDollars = (target.nominalDollars ?? 0) + delta.nominalDollars;
  }
}

function assertStatesMatch(expected: ContainerState[], actual: ContainerState[]) {
  const actualById = new Map(actual.map((state) => [state.id, state]));

  for (const expectedState of expected) {
    const actualState = actualById.get(expectedState.id);
    if (!actualState) {
      throw new Error(`Missing computed state ${expectedState.id}`);
    }

    assertApproxEqual(
      `qty mismatch for ${expectedState.id}`,
      actualState.quantifiedComposition.qty,
      expectedState.quantifiedComposition.qty
    );

    if (actualState.quantifiedComposition.unit !== expectedState.quantifiedComposition.unit) {
      throw new Error(
        `unit mismatch for ${expectedState.id}: ${actualState.quantifiedComposition.unit} vs ${expectedState.quantifiedComposition.unit}`
      );
    }

    assertCompositionEqual(
      `composition mismatch for ${expectedState.id}`,
      actualState.quantifiedComposition,
      expectedState.quantifiedComposition
    );

    actualById.delete(expectedState.id);
  }

  if (actualById.size > 0) {
    const extras = Array.from(actualById.keys()).join(", ");
    throw new Error(`Computed unexpected states: ${extras}`);
  }
}

function assertApproxEqual(label: string, actual: number, expected: number) {
  const tolerance = 0.0001;
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

  
function buildDirectTransferScenario2(): CompositionScenario {
  const tankA: Container = {
    id: "tankA",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    name: "Tank A",
    type: "tank",
  };

  const tankB: Container = {
    id: "tankB",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    name: "Tank B",
    type: "tank",
  };

  const TankA0: ContainerState = {
    id: "tankA0",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container: tankA,
    quantifiedComposition: {
      qty: 1000,
      unit: "gal",
      varietals: { chardonnay: 1000 },
      realDollars: 5000,
      nominalDollars: 4800,
    },
    timestamp: ZERO_TIME,
  };

  const TankA1: ContainerState = {
    id: "tankA1",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container: tankA,
    quantifiedComposition: {
      qty: 900,
      unit: "gal",
      varietals: { chardonnay: 900 },
      realDollars: 4500,
      nominalDollars: 4320,
    },
    timestamp: ZERO_TIME,
  };

  const TankB0: ContainerState = {
    id: "tankB0",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container: tankB,
    quantifiedComposition: {
      qty: 0,
      unit: "gal",
      varietals: { },
      realDollars: 0,
      nominalDollars: 0,
    },
    timestamp: ZERO_TIME,
  };

  const TankB1: ContainerState = {
    id: "tankB1",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container: tankB,
    quantifiedComposition: {
      qty: 100,
      unit: "gal",
      varietals: { chardonnay: 100 },
      realDollars: 500,
      nominalDollars: 480,
    },
    timestamp: ZERO_TIME,
  };

  const flows: FlowToRelationship[] = [
    {
      from: { id: TankA0.id },
      to: { id: TankA1.id },
      properties: {
        qty: -100,
        unit: "gal",
        varietals: { chardonnay: -100 },
        realDollars: -500,
        nominalDollars: -480,
      },
    },{
      from: { id: TankA0.id },
      to: { id: TankB1.id },
      properties: {
        qty: 100,
        unit: "gal",
        varietals: { chardonnay: 100 },
        realDollars: 500,
        nominalDollars: 480,
      },
    },
  ];

  return {
    name: "remaing_after_partial_transfer",
    inputStates: [TankA0, TankB0],
    flows,
    expectedCompositions: [TankA1, TankB1],
  };
}

function buildGeneratedTransferScenario(): CompositionScenario {
  const tankA: Container = {
    id: "tankA_gen",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    name: "Tank A Generated",
    type: "tank",
  };

  const tankB: Container = {
    id: "tankB_gen",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    name: "Tank B Generated",
    type: "tank",
  };

  const TankA0: ContainerState = {
    id: "tankA0_gen",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container: tankA,
    quantifiedComposition: {
      qty: 1000,
      unit: "gal",
      varietals: { chardonnay: 1000 },
      realDollars: 5000,
      nominalDollars: 4800,
    },
    timestamp: ZERO_TIME,
  };

  const TankA1: ContainerState = {
    id: "tankA1_gen",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container: tankA,
    quantifiedComposition: {
      qty: 900,
      unit: "gal",
      varietals: { chardonnay: 900 },
      realDollars: 4500,
      nominalDollars: 4320,
    },
    timestamp: ZERO_TIME,
  };

  const TankB0: ContainerState = {
    id: "tankB0_gen",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container: tankB,
    quantifiedComposition: {
      qty: 0,
      unit: "gal",
      varietals: {},
      realDollars: 0,
      nominalDollars: 0,
    },
    timestamp: ZERO_TIME,
  };

  const TankB1: ContainerState = {
    id: "tankB1_gen",
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container: tankB,
    quantifiedComposition: {
      qty: 100,
      unit: "gal",
      varietals: { chardonnay: 100 },
      realDollars: 500,
      nominalDollars: 480,
    },
    timestamp: ZERO_TIME,
  };

  return {
    name: "generated_transfer_with_helper",
    inputStates: [TankA0, TankB0],
    operation: (inputs) => generateTransferFlows(inputs[0], inputs[1], 100),
    expectedCompositions: [TankA1, TankB1],
  };
}