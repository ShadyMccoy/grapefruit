// Clear all nodes and relationships
MATCH (n)
DETACH DELETE n;

// Starter data: Appellations, Vineyards, Varietals, Blocks, WeighTags
CREATE 
// Appellations
(napa:Appellation {name: 'Napa Valley'}),
(sonoma:Appellation {name: 'Sonoma'}),
(northCoast:Appellation {name: 'North Coast'}),

// Vineyards linked to Appellations
(sunset:Vineyard {name:'Sunset Vineyards'})-[:IN_APPELLATION]->(napa),
(sunset)-[:IN_APPELLATION]->(northCoast),
(golden:Vineyard {name:'Golden Hills'})-[:IN_APPELLATION]->(sonoma),
(golden)-[:IN_APPELLATION]->(northCoast),

// Varietals
(cabernet:Varietal {name:'Cabernet Sauvignon'}),
(chardonnay:Varietal {name:'Chardonnay'}),
(merlot:Varietal {name:'Merlot'}),

// Blocks for Sunset Vineyards
(sunsetA:Block {name:'Sunset Block A'})-[:PART_OF_VINEYARD]->(sunset),
(sunsetB:Block {name:'Sunset Block B'})-[:PART_OF_VINEYARD]->(sunset),
(sunsetA)-[:OF_VARIETAL]->(cabernet),
(sunsetB)-[:OF_VARIETAL]->(merlot),

// Blocks for Golden Hills
(goldenA:Block {name:'Golden Block A'})-[:PART_OF_VINEYARD]->(golden),
(goldenB:Block {name:'Golden Block B'})-[:PART_OF_VINEYARD]->(golden),
(goldenA)-[:OF_VARIETAL]->(chardonnay),
(goldenB)-[:OF_VARIETAL]->(cabernet),

// WeighTags for Sunset Blocks
(sunsetTag1:WeighTag {tagNumber:'ST-A-001', weightLbs:1200, vintage:2024})-[:FROM_BLOCK]->(sunsetA),
(sunsetTag2:WeighTag {tagNumber:'ST-A-002', weightLbs:950, vintage:2024})-[:FROM_BLOCK]->(sunsetA),
(sunsetTag3:WeighTag {tagNumber:'ST-B-001', weightLbs:1100, vintage:2024})-[:FROM_BLOCK]->(sunsetB),

// WeighTags for Golden Blocks
(goldenTag1:WeighTag {tagNumber:'GH-A-001', weightLbs:1300, vintage:2024})-[:FROM_BLOCK]->(goldenA),
(goldenTag2:WeighTag {tagNumber:'GH-B-001', weightLbs:1250, vintage:2024})-[:FROM_BLOCK]->(goldenB),
(goldenTag3:WeighTag {tagNumber:'GH-B-002', weightLbs:1400, vintage:2024})-[:FROM_BLOCK]->(goldenB);
