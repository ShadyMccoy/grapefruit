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

