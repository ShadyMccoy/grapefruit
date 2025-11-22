
export const typeDefs = `#graphql
  scalar JSON

  type QuantifiedComposition {
    qty: String!
    unit: String!
    attributes: JSON
  }

  type ContainerState {
    id: ID!
    quantifiedComposition: QuantifiedComposition!
    timestamp: String!
    container: Container
  }

  type WineryOperation {
    id: ID!
    type: String!
    description: String
    timestamp: String
  }

  type Container {
    id: ID!
    name: String!
    type: String!
    capacityHUnits: String
    currentState: ContainerState
    members: [Container!]
    history: [WineryOperation!]
  }

  type Query {
    containers(limit: Int, offset: Int): [Container!]!
    container(id: ID!): Container
    operations: [WineryOperation!]!
  }
`;
