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
3. Seed Containers via TypeScript

After the database is running, you can seed containers with your TypeScript script:

```powershell
npx tsx src/scripts/seedContainers.ts
```

This will create initial Container nodes (tanks, barrels, presses, bottles) in Neo4j.

4. Create Example Winery Operations

You can run the fake operations script to generate example WineryOperation nodes and relationships:


```powershell
npx tsx src/scripts/testWineryOperations.ts
```

This will:

Create a WineryOperation node (e.g., a blend)

Connect preseeded container states as inputs (WINERY_OP_INPUT)

Create new container states as outputs (WINERY_OP_OUTPUT)

Link all states to their containers via STATE_OF

You can now query the graph in Neo4j to see lineage and trace material flow:

```cypher
MATCH (c:Container)-[:STATE_OF]->(s:ContainerState)<-[r:WINERY_OP_OUTPUT]-(op:WineryOperation)
RETURN c, s, r, op
```
