import { Container } from "../domain/nodes/Container";
import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { generateFlowCompositions, calculateBlendComposition } from "../core/CompositionHelpers";

interface CompositionScenario {
  name: string;
  inputStates: ContainerState[];
  flows?: FlowToRelationship[]; // Optional: can be generated
  expectedCompositions: ContainerState[];
  operation?: (inputs: ContainerState[]) => FlowToRelationship[]; // Optional: generate flows from inputs
}

const HARNESS_TENANT = "harness_tenant";
const ZERO_TIME = new Date("2000-01-01T00:00:00.000Z");

// Helper functions to reduce boilerplate in scenario definitions
function createContainer(id: string, name: string, type: Container["type"] = "tank"): Container {
  return {
    id,
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    name,
    type,
  };
}

function createState(
  id: string,
  container: Container,
  qty: number,
  varietals: Record<string, number> = {},
  realDollars: number = 0,
  nominalDollars: number = 0,
  unit: "gal" | "lbs" | "$" = "gal"
): ContainerState {
  return {
    id,
    tenantId: HARNESS_TENANT,
    createdAt: ZERO_TIME,
    container,
    quantifiedComposition: {
      qty,
      unit,
      varietals,
      realDollars,
      nominalDollars,
    },
    timestamp: ZERO_TIME,
  };
}

const scenarios: CompositionScenario[] = [
  buildDirectTransferScenario(
    1000, { chardonnay: 1000 }, 5000, 4800,
    100
  ),
  buildGeneratedTransferScenario(
    1000, { chardonnay: 1000 }, 5000, 4800,
    100
  ),
  buildBlendScenario(
    500, { chardonnay: 500 }, 2500, 2400,
    300, { pinot_noir: 300 }, 1800, 1500
  ),
  buildBlendScenario(
    501, { chardonnay: 501 }, 2500, 2400,
    300, { pinot_noir: 300 }, 1800, 1500
  ),
  buildBlendScenario(
    502, { chardonnay: 502 }, 2500, 2400,
    300, { pinot_noir: 300 }, 1800, 1500
  ),
  buildBlendScenario(
    503, { chardonnay: 503 }, 2500, 2400,
    300, { pinot_noir: 300 }, 1800, 1500
  ),
  buildBlendScenario(
    1, { chardonnay: 1 }, 10, 10,
    0, { pinot_noir: 0 }, 0, 0
  ),
  buildBlendIntoNonEmptyTankScenario(
    400, { chardonnay: 400 }, 2000, 1920,
    200, { pinot_noir: 200 }, 1200, 1000,
    200, { merlot: 200 }, 900, 800
  )
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

  
function buildDirectTransferScenario(
  qtyA: number,
  varietalsA: Record<string, number>,
  realA: number,
  nominalA: number,
  transferQty: number
): CompositionScenario {
  const tankA = createContainer("tankA", "Tank A");
  const tankB = createContainer("tankB", "Tank B");

  const TankA0 = createState("tankA0", tankA, qtyA, varietalsA, realA, nominalA);
  
  // Calculate remaining in tank A after transfer
  const remainingQty = qtyA - transferQty;
  const remainingVarietals: Record<string, number> = {};
  for (const [varietal, amount] of Object.entries(varietalsA)) {
    remainingVarietals[varietal] = Math.floor((amount * remainingQty) / qtyA);
  }
  const remainingReal = Math.floor((realA * remainingQty) / qtyA);
  const remainingNominal = Math.floor((nominalA * remainingQty) / qtyA);
  
  const TankA1 = createState("tankA1", tankA, remainingQty, remainingVarietals, remainingReal, remainingNominal);
  
  // Calculate transferred amounts
  const transferredVarietals: Record<string, number> = {};
  for (const [varietal, amount] of Object.entries(varietalsA)) {
    transferredVarietals[varietal] = Math.floor((amount * transferQty) / qtyA);
  }
  const transferredReal = Math.floor((realA * transferQty) / qtyA);
  const transferredNominal = Math.floor((nominalA * transferQty) / qtyA);
  
  const TankB0 = createState("tankB0", tankB, 0, {}, 0, 0);
  const TankB1 = createState("tankB1", tankB, transferQty, transferredVarietals, transferredReal, transferredNominal);

  const flows: FlowToRelationship[] = [
    {
      from: { id: TankA0.id },
      to: { id: TankA1.id },
      properties: {
        qty: -transferQty,
        unit: "gal",
        varietals: Object.fromEntries(
          Object.entries(transferredVarietals).map(([k, v]) => [k, -v])
        ),
        realDollars: -transferredReal,
        nominalDollars: -transferredNominal,
      },
    },{
      from: { id: TankA0.id },
      to: { id: TankB1.id },
      properties: {
        qty: transferQty,
        unit: "gal",
        varietals: transferredVarietals,
        realDollars: transferredReal,
        nominalDollars: transferredNominal,
      },
    },
  ];

  return {
    name: "remaining_after_partial_transfer",
    inputStates: [TankA0, TankB0],
    flows,
    expectedCompositions: [TankA1, TankB1],
  };
}

function buildGeneratedTransferScenario(
  qtyA: number,
  varietalsA: Record<string, number>,
  realA: number,
  nominalA: number,
  transferQty: number
): CompositionScenario {
  const tankA = createContainer("tankA", "Tank A");
  const tankB = createContainer("tankB", "Tank B");

  const TankA0 = createState("TankA0", tankA, qtyA, varietalsA, realA, nominalA);
  
  // Calculate remaining in tank A after transfer
  const remainingQty = qtyA - transferQty;
  const remainingVarietals: Record<string, number> = {};
  for (const [varietal, amount] of Object.entries(varietalsA)) {
    remainingVarietals[varietal] = Math.floor((amount * remainingQty) / qtyA);
  }
  const remainingReal = Math.floor((realA * remainingQty) / qtyA);
  const remainingNominal = Math.floor((nominalA * remainingQty) / qtyA);
  
  const TankA1 = createState("TankA1", tankA, remainingQty, remainingVarietals, remainingReal, remainingNominal);
  
  // Calculate transferred amounts
  const transferredVarietals: Record<string, number> = {};
  for (const [varietal, amount] of Object.entries(varietalsA)) {
    transferredVarietals[varietal] = Math.floor((amount * transferQty) / qtyA);
  }
  const transferredReal = Math.floor((realA * transferQty) / qtyA);
  const transferredNominal = Math.floor((nominalA * transferQty) / qtyA);
  
  const TankB0 = createState("TankB0", tankB, 0, {}, 0, 0);
  const TankB1 = createState("TankB1", tankB, transferQty, transferredVarietals, transferredReal, transferredNominal);

  return {
    name: "generated_transfer_with_helper",
    inputStates: [TankA0, TankB0],
    operation: (inputs) => {
      const [negativeFlow, positiveFlow] = generateFlowCompositions(
        inputs[0].quantifiedComposition,
        transferQty
      );

      // Create flows manually with proper state IDs
      return [
        // Negative flow from TankA0 to TankA1 (what's leaving)
        {
          from: { id: TankA0.id },
          to: { id: TankA1.id },
          properties: negativeFlow
        },
        // Positive flow from TankA0 to TankB1 (what's arriving)
        {
          from: { id: TankA0.id },
          to: { id: TankB1.id },
          properties: positiveFlow
        }
      ];
    },
    expectedCompositions: [TankA1, TankB1],
  };
}
function buildBlendScenario(
  qtyA: number,
  varietalsA: Record<string, number>,
  realA: number,
  nominalA: number,
  qtyB: number,
  varietalsB: Record<string, number>,
  realB: number,
  nominalB: number
): CompositionScenario {
  // Intent: Blend two input tanks into one output tank using calculateBlendComposition
  // Scenario: Tank A + Tank B → Tank C (empty → blend)
  
  const tankA = createContainer("tankA_blend", "Tank A Blend Source");
  const tankB = createContainer("tankB_blend", "Tank B Blend Source");
  const tankC = createContainer("tankC_blend", "Tank C Blend Destination");

  const TankA0 = createState("tankA0_blend", tankA, qtyA, varietalsA, realA, nominalA);
  const TankA1 = createState("tankA1_blend", tankA, 0, {}, 0, 0);
  const TankB0 = createState("tankB0_blend", tankB, qtyB, varietalsB, realB, nominalB);
  const TankB1 = createState("tankB1_blend", tankB, 0, {}, 0, 0);
  const TankC0 = createState("tankC0_blend", tankC, 0, {}, 0, 0);
  
  // Calculate expected final composition
  const mergedVarietals = { ...varietalsA };
  for (const [varietal, amount] of Object.entries(varietalsB)) {
    mergedVarietals[varietal] = (mergedVarietals[varietal] || 0) + amount;
  }
  const TankC1 = createState("tankC1_blend", tankC, qtyA + qtyB, mergedVarietals, realA + realB, nominalA + nominalB);

  return {
    name: "blend_two_tanks_with_helper",
    inputStates: [TankA0, TankB0, TankC0],
    operation: (inputs) => {
      // Generate flows from each source tank to destination
      const [negativeFlowA, positiveFlowA] = generateFlowCompositions(
        inputs[0].quantifiedComposition,
        qtyA
      );
      
      const [negativeFlowB, positiveFlowB] = generateFlowCompositions(
        inputs[1].quantifiedComposition,
        qtyB
      );

      // Use calculateBlendComposition to determine final composition
      // Start with empty tank C, add flows from A and B
      const blendedComposition = calculateBlendComposition(
        inputs[2], // TankC0 (empty destination)
        [positiveFlowA, positiveFlowB] // Incoming flows from both tanks
      );

      // Verify the blend matches our expectation
      if (blendedComposition.qty !== qtyA + qtyB) {
        throw new Error(`Blend qty mismatch: expected ${qtyA + qtyB}, got ${blendedComposition.qty}`);
      }

      return [
        // Negative flow from TankA0 to TankA1 (empty it)
        {
          from: { id: inputs[0].id },
          to: { id: TankA1.id },
          properties: negativeFlowA
        },
        // Positive flow from TankA0 to TankC1 (contributing to blend)
        {
          from: { id: inputs[0].id },
          to: { id: TankC1.id },
          properties: positiveFlowA
        },
        // Negative flow from TankB0 to TankB1 (empty it)
        {
          from: { id: inputs[1].id },
          to: { id: TankB1.id },
          properties: negativeFlowB
        },
        // Positive flow from TankB0 to TankC1 (contributing to blend)
        {
          from: { id: inputs[1].id },
          to: { id: TankC1.id },
          properties: positiveFlowB
        }
      ];
    },
    expectedCompositions: [TankA1, TankB1, TankC1],
  };
}

function buildBlendIntoNonEmptyTankScenario(
  qtyA: number,
  varietalsA: Record<string, number>,
  realA: number,
  nominalA: number,
  qtyB: number,
  varietalsB: Record<string, number>,
  realB: number,
  nominalB: number,
  qtyC: number,
  varietalsC: Record<string, number>,
  realC: number,
  nominalC: number
): CompositionScenario {
  // Intent: Blend two input tanks into Tank C that already contains wine
  // Scenario: Tank A + Tank B → Tank C (existing wine → blend)
  
  const tankA = createContainer("tankA_blend2", "Tank A Blend Source 2");
  const tankB = createContainer("tankB_blend2", "Tank B Blend Source 2");
  const tankC = createContainer("tankC_blend2", "Tank C Non-Empty Destination");

  const TankA0 = createState("tankA0_blend2", tankA, qtyA, varietalsA, realA, nominalA);
  const TankA1 = createState("tankA1_blend2", tankA, 0, {}, 0, 0);
  const TankB0 = createState("tankB0_blend2", tankB, qtyB, varietalsB, realB, nominalB);
  const TankB1 = createState("tankB1_blend2", tankB, 0, {}, 0, 0);
  const TankC0 = createState("tankC0_blend2", tankC, qtyC, varietalsC, realC, nominalC);
  
  // Calculate expected final composition
  const mergedVarietals = { ...varietalsC };
  for (const [varietal, amount] of Object.entries(varietalsA)) {
    mergedVarietals[varietal] = (mergedVarietals[varietal] || 0) + amount;
  }
  for (const [varietal, amount] of Object.entries(varietalsB)) {
    mergedVarietals[varietal] = (mergedVarietals[varietal] || 0) + amount;
  }
  const TankC1 = createState("tankC1_blend2", tankC, qtyA + qtyB + qtyC, mergedVarietals, realA + realB + realC, nominalA + nominalB + nominalC);

  return {
    name: "blend_into_nonempty_tank_with_helper",
    inputStates: [TankA0, TankB0, TankC0],
    operation: (inputs) => {
      // Generate flows from each source tank to destination
      const [negativeFlowA, positiveFlowA] = generateFlowCompositions(
        inputs[0].quantifiedComposition,
        qtyA
      );
      
      const [negativeFlowB, positiveFlowB] = generateFlowCompositions(
        inputs[1].quantifiedComposition,
        qtyB
      );

      // Use calculateBlendComposition to determine final composition
      // Start with Tank C containing existing wine, add flows from A and B
      const blendedComposition = calculateBlendComposition(
        inputs[2], // TankC0 (already has wine)
        [positiveFlowA, positiveFlowB] // Incoming flows from both tanks
      );

      // Verify the blend matches our expectation
      if (blendedComposition.qty !== qtyA + qtyB + qtyC) {
        throw new Error(`Blend qty mismatch: expected ${qtyA + qtyB + qtyC}, got ${blendedComposition.qty}`);
      }
      // Verify original varietals are preserved
      for (const [varietal, expectedAmount] of Object.entries(varietalsC)) {
        if (!blendedComposition.varietals?.[varietal] || blendedComposition.varietals[varietal] !== expectedAmount) {
          throw new Error(`Expected ${varietal} to be preserved at ${expectedAmount} gal`);
        }
      }

      return [
        // Negative flow from TankA0 to TankA1 (empty it)
        {
          from: { id: inputs[0].id },
          to: { id: TankA1.id },
          properties: negativeFlowA
        },
        // Positive flow from TankA0 to TankC1 (contributing to blend)
        {
          from: { id: inputs[0].id },
          to: { id: TankC1.id },
          properties: positiveFlowA
        },
        // Negative flow from TankB0 to TankB1 (empty it)
        {
          from: { id: inputs[1].id },
          to: { id: TankB1.id },
          properties: negativeFlowB
        },
        // Positive flow from TankB0 to TankC1 (contributing to blend)
        {
          from: { id: inputs[1].id },
          to: { id: TankC1.id },
          properties: positiveFlowB
        }
      ];
    },
    expectedCompositions: [TankA1, TankB1, TankC1],
  };
}
