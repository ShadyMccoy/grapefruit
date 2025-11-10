# Grapefruit Graph Setup

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

This creates a complete "kitchen sink" dataset with:
- Base winery data (appellations, vineyards, varietals, blocks, weigh tags)
- Containers (tanks, barrels, loss containers)
- Initial container states with quantities and compositions
- Sample operations (blends, transfers) with proper relationships

## 3. Additional Testing

For additional operation testing or specific scenarios, create new scripts following the pattern in `seedAll.ts`.

## 4. Query and Visualize

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
