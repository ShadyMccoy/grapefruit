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

## 2. Load Starter Data

We provide a starter dataset with Appellations, Vineyards, Varietals, and Blocks.

Run the following command to **delete everything and reload starter data**

This pipes the 01-starter-data.cypher file in neo4j as a Cypher command:

```powershell
Get-Content .\docker-init\01-starter-data.cypher | docker compose exec -T neo4j cypher-shell -u neo4j -p testpassword
```

## 3. Seed Comprehensive Test Data

Load comprehensive starter data for testing and validation:

```powershell
cd api
npx tsx src/scripts/seedAll.ts
```

This creates a "kitchen sink" dataset with:
- Containers (tanks, barrels, loss containers)
- Initial container states with quantities and compositions
- Sample operations (blends, transfers) with proper relationships

## 4. Additional Testing

For additional operation testing or specific scenarios, create new scripts following the pattern in `seedAll.ts`.

## 5. Query and Visualize

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
