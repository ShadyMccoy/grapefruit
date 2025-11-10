# Alternative Seeding Method: Cypher File Loading

## Overview
The `01-starter-data.cypher` file contains base starter data (appellations, vineyards, varietals) that can be loaded directly into Neo4j using the Cypher shell.

## Usage
```powershell
Get-Content .\docker-init\01-starter-data.cypher | docker compose exec -T neo4j cypher-shell -u neo4j -p testpassword
```

## When to Use
- For quick database initialization during development
- When you need to load base reference data (appellations, vineyards, varietals)
- For testing Cypher syntax and data structure
- When you prefer raw Cypher over TypeScript abstractions

## Current Status
This method is preserved for reference but is not used in the standard setup process. The primary seeding method now uses TypeScript objects in `src/config/starterData.ts` for better type safety and integration with the repository pattern.

## File Location
`docker-init/01-starter-data.cypher`

## Note
This method loads only base reference data. For complete seeding including containers, states, and operations, use the TypeScript seeding method in `src/scripts/seedAll.ts`.