// db/repositories/WeighTagRepo.ts
// Intent: Provide typed interface for WeighTag persistence in Neo4j
// Reasoning: Follows existing repository pattern for domain entities

import { Session } from "neo4j-driver";
import { WeighTag } from "../../domain/nodes/VocabNodes";
import {
  serializeAttributes,
  deserializeAttributes,
} from "../../util/attributeSerialization";

export class WeighTagRepo {
  constructor(private session: Session) {}

  async create(weighTag: WeighTag): Promise<void> {
    await this.session.run(
      `
      CREATE (w:WeighTag {
        id: $id,
        tagNumber: $tagNumber,
        weightLbs: $weightLbs,
        vintage: $vintage,
        qty: $qty,
        unit: $unit,
        composition: $composition,
        tenantId: $tenantId,
        createdAt: datetime($createdAt)
      })
      `,
      {
        id: weighTag.id,
        tagNumber: weighTag.tagNumber,
        weightLbs: weighTag.weightLbs,
        vintage: weighTag.vintage,
        qty: weighTag.quantifiedComposition.qty,
        unit: weighTag.quantifiedComposition.unit,
        composition: serializeAttributes(weighTag.quantifiedComposition.attributes),
        tenantId: weighTag.tenantId,
        createdAt: weighTag.createdAt.toISOString(),
      }
    );

    // If blockId is provided, create relationship to Block
    if (weighTag.blockId) {
      await this.session.run(
        `
        MATCH (w:WeighTag {id: $weighTagId})
        MATCH (b:Block {id: $blockId})
        CREATE (w)-[:FROM_BLOCK]->(b)
        `,
        {
          weighTagId: weighTag.id,
          blockId: weighTag.blockId,
        }
      );
    }
  }

  async findById(id: string): Promise<WeighTag | null> {
    const result = await this.session.run(
      `MATCH (w:WeighTag {id: $id}) RETURN w`,
      { id }
    );
    if (result.records.length === 0) return null;
    
    const w = result.records[0].get("w").properties;
    return {
      id: w.id,
      tagNumber: w.tagNumber,
      weightLbs: w.weightLbs,
      vintage: w.vintage,
      tenantId: w.tenantId,
      createdAt: new Date(w.createdAt),
      quantifiedComposition: {
        qty: BigInt(w.qty),
        unit: w.unit,
        attributes: deserializeAttributes(w.composition ?? "{}")
      }
    } as WeighTag;
  }

  async findAll(): Promise<WeighTag[]> {
    const result = await this.session.run(`MATCH (w:WeighTag) RETURN w`);
    return result.records.map(r => {
      const w = r.get("w").properties;
      return {
        id: w.id,
        tagNumber: w.tagNumber,
        weightLbs: w.weightLbs,
        vintage: w.vintage,
        tenantId: w.tenantId,
        createdAt: new Date(w.createdAt),
        quantifiedComposition: {
          qty: BigInt(w.qty),
          unit: w.unit,
          attributes: deserializeAttributes(w.composition ?? "{}")
        }
      } as WeighTag;
    });
  }
}
