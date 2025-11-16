import { Container } from "../domain/nodes/Container";
import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { distributeComposition, blendCompositions } from "../core/CompositionHelpers";

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
  qty: bigint,
  varietals: Record<string, bigint> = {},
  realDollars: bigint = 0n,
  nominalDollars: bigint = 0n,
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
      attributes: {
        varietals,
        realDollars,
        nominalDollars,
      },
    },
    timestamp: ZERO_TIME,
    flowsTo: [],
    flowsFrom: [],
  };
}

const scenarios: CompositionScenario[] = [
  // to do make new scenarios to test blending and distribution
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
    for (const state of scenario.inputStates) {
      validateConservation(state);
    }

    // to do: replace with compositionHelpers calls
    //const computedStates = ContainerState[]; //computeOutputStates(scenarioWithFlows);
    //assertCompositionsMatch(scenarioWithFlows.expectedCompositions, computedStates);
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
function validateConservation(containerState : ContainerState) {
  //sum container state flows qty using lodash style reduce function
  let netQty = 0n;

  for (const flow of containerState.flowsFrom) {
    netQty += flow.properties.qty;
  }

  assertZeroNumber(`net qty for ${containerState.id}`, netQty);
}

function assertCompositionEqual(
  label: string,
  actual: Partial<ContainerState>,
  expected: Partial<ContainerState>
) {
  const actualVarietals = actual.quantifiedComposition?.attributes.varietals as Record<string, bigint> || {};
  const expectedVarietals = expected.quantifiedComposition?.attributes.varietals as Record<string, bigint> || {};
  const varietalKeys = new Set([
    ...Object.keys(actualVarietals),
    ...Object.keys(expectedVarietals),
  ]);

  for (const key of varietalKeys) {
    assertNumberEqual(
      `${label} varietal ${key}`,
      actualVarietals[key] || 0n,
      expectedVarietals[key] || 0n
    );
  }

  assertNumberEqual(
    `${label} real dollars`,
    actual.quantifiedComposition?.attributes.realDollars as bigint || 0n,
    expected.quantifiedComposition?.attributes.realDollars as bigint || 0n
  );
  assertNumberEqual(
    `${label} nominal dollars`,
    actual.quantifiedComposition?.attributes.nominalDollars as bigint || 0n,
    expected.quantifiedComposition?.attributes.nominalDollars as bigint || 0n
  );
}

function assertNumberEqual(label: string, actual: bigint, expected: bigint) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertZeroNumber(label: string, value: bigint) {
  if (value !== 0n) {
    throw new Error(`${label}: expected 0, received ${value}`);
  }
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
      qty: 0n,
      unit: template?.quantifiedComposition?.unit ?? flow.properties.unit,
      attributes: {
        varietals: {},
        realDollars: 0n,
        nominalDollars: 0n,
      },
    },
    timestamp: template?.timestamp ?? ZERO_TIME,
    flowsTo: [],
    flowsFrom: [],
  };
}

function assertCompositionsMatch(expected: ContainerState[], actual: ContainerState[]) {
  const actualById = new Map(actual.map((state) => [state.id, state]));

  for (const expectedState of expected) {
    const actualState = actualById.get(expectedState.id);
    if (!actualState) {
      throw new Error(`Missing computed state ${expectedState.id}`);
    }

    assertNumberEqual(
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
      actualState,
      expectedState
    );

    actualById.delete(expectedState.id);
  }

  if (actualById.size > 0) {
    const extras = Array.from(actualById.keys()).join(", ");
    throw new Error(`Computed unexpected states: ${extras}`);
  }
}
