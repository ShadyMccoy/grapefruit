# Grapefruit API Setup

---

## 1. Create Docker containers

Start the containers:

```powershell
docker compose up -d
```

Check that the containers are running:

```powershell
docker compose ps
```

View the Neo4j database in your browser:

```
http://localhost:7474/browser/
```

---

## 2. Seed Comprehensive Test Data

Load all starter data for testing and validation:

```powershell
cd api
npx tsx src/scripts/seedAll.ts
```

This creates a complete test dataset with:
- 5 containers (tanks, barrels, loss container)
- Initial container states with quantities and compositions
- Sample transfer operation with proper relationships and flows

## 3. Run API Server

Start the development server with hot reload:

```powershell
cd api
npm run dev
```

The API will be available at `http://localhost:3000` (or configured port).

## 4. Test Cypher Operations

Run incremental Cypher testing to validate operation logic:

```powershell
cd api
npx tsx src/scripts/testCypher.ts
```

This tests individual Cypher patterns and operations before integration.

## 5. Verify Database State

Check the seeded database for correctness:

```powershell
cd api
npx tsx src/scripts/verifySeeding.ts
```

This validates container counts, relationships, and operation connections.

## 6. Query and Visualize

Access the Neo4j Browser at `http://localhost:7474` (auth: `neo4j/testpassword`) for graph queries and visualization.

Example query to view operation lineage:

```cypher
MATCH (c:Container)-[:STATE_OF]->(s:ContainerState)<-[:WINERY_OP_OUTPUT]-(op:WineryOperation)
RETURN c, s, op
```

Trace container history:

```cypher
MATCH path = (initial:ContainerState)-[:FLOW_TO*]->(current:ContainerState)
WHERE NOT (initial)<-[:FLOW_TO]-()
RETURN path
```