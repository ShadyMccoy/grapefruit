# Grapefruit Project - GitHub Copilot Instructions

## Project Overview
This is a TypeScript-based backend API that uses Neo4j graph database to model and track container movements and winery operations. The system manages containers, their states, and operations performed at wineries.

## Technology Stack
- **Language**: TypeScript
- **Runtime**: Node.js
- **Database**: Neo4j (Graph Database)
- **Driver**: neo4j-driver
- **Container Orchestration**: Docker & Docker Compose

## Architecture & Patterns

### Domain-Driven Design
The project follows domain-driven design principles with a clear separation of concerns:
- **Domain Layer**: Contains node and relationship models representing the graph structure
- **Repository Layer**: Handles database operations and queries
- **Core Layer**: Validation and invariant checking

### Graph Model
- **Nodes**: Container, ContainerState, WineryOperation, and starter nodes
- **Relationships**: Movement and other graph relationships
- **Base Patterns**: All nodes extend `BaseNode` with common properties

## Code Style & Conventions

### TypeScript Best Practices
- Use explicit types, avoid `any`
- Leverage interfaces for contracts
- Use async/await for asynchronous operations
- Export classes and types appropriately

### Neo4j Patterns
- Use parameterized Cypher queries to prevent injection
- Follow Neo4j naming conventions (PascalCase for labels, SCREAMING_SNAKE_CASE for relationship types)
- Use `MERGE` for idempotent operations
- Include proper index and constraint definitions

### File Organization
- Domain models in `api/src/domain/nodes/` and `api/src/domain/relationships/`
- Repositories in `api/src/db/repositories/`
- Scripts for testing and seeding in `api/src/scripts/`
- Database initialization in `docker-init/`

## Key Components

### BaseNode Pattern
All domain nodes should extend `BaseNode` which provides:
- UUID-based identification
- Created/updated timestamps
- Common serialization methods

### Repository Pattern
Repositories should:
- Handle all database interactions for their domain entity
- Use the Neo4j driver session pattern
- Return domain objects, not raw query results
- Include error handling and validation

### ValidationResult
Use the `ValidationResult` class from `api/src/core/` for validation logic:
- Return validation results with success/failure status
- Include descriptive error messages
- Chain validations when needed

## Development Guidelines

### When Creating New Domain Nodes
1. Extend `BaseNode`
2. Define clear properties with types
3. Include validation logic
4. Create corresponding repository class
5. Add necessary Cypher queries

### When Creating New Repositories
1. Follow the pattern in existing repositories (e.g., `ContainerRepo.ts`)
2. Use dependency injection for the Neo4j driver
3. Implement CRUD operations as needed
4. Use transactions for multi-step operations
5. Include proper error handling

### When Writing Cypher Queries
1. Use parameterized queries
2. Include appropriate `WHERE` clauses
3. Use `MERGE` for upserts
4. Consider query performance (indexes, limits)
5. Return relevant data with `RETURN` clauses

### When Creating Scripts
1. Place in `api/src/scripts/`
2. Include proper imports and setup
3. Handle async operations correctly
4. Close database connections when done
5. Include descriptive logging

## Common Tasks

### Adding a New Node Type
```typescript
// In api/src/domain/nodes/NewNode.ts
export class NewNode extends BaseNode {
  constructor(
    id: string,
    public property1: string,
    public property2: number,
    created?: Date,
    updated?: Date
  ) {
    super(id, created, updated);
  }
}
```

### Adding a New Repository
```typescript
// In api/src/db/repositories/NewNodeRepo.ts
export class NewNodeRepo {
  constructor(private driver: Driver) {}
  
  async create(node: NewNode): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `CREATE (n:NewNode {id: $id, property1: $property1, property2: $property2})`,
        { id: node.id, property1: node.property1, property2: node.property2 }
      );
    } finally {
      await session.close();
    }
  }
}
```

## Documentation References
- See `docs/GRAPH_MODEL.md` for graph structure details
- See `docs/APPLICATION_LOGIC.md` for business logic
- See `docs/WORKFLOW_MODEL.md` for process flows
- See `docs/SETUP.md` for development setup

## Testing & Debugging
- Test scripts are in `api/src/scripts/`
- Use `docker-compose up` to start Neo4j locally
- Access Neo4j Browser at `http://localhost:7474`
- Check logs in `db/logs/` for database issues

## Important Notes
- Always validate input before database operations
- Use UUIDs for node IDs
- Handle Neo4j driver lifecycle properly (close sessions)
- Consider transaction boundaries for related operations
- Follow the existing patterns in the codebase

You are my coding assistant for the Grapefruit project. When I ask you to generate code, please follow the architecture, patterns, and conventions outlined in this prompt as well as the details from the documentation snippets provided.

Stay focused on the current task at hand in the overall project.

See the docs files for more context:
- docs/GRAPH_MODEL.md
- docs/APPLICATION_LOGIC.md
- docs/WORKFLOW_MODEL.md
- docs/SETUP.md

---