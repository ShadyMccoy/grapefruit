import { BaseNode } from "./BaseNode";
import { Composition } from "./ContainerState";

export interface Appellation extends BaseNode {
  name: string;
}

export interface Vineyard extends BaseNode {
  name: string;
  appellations?: Appellation[]; // outgoing relationships
  blocks?: Block[];             // incoming relationships (reverse)
}

export interface Varietal extends BaseNode {
  name: string;
}

export interface Block extends BaseNode {
  name: string;
  vineyard?: Vineyard;          // part of
  varietal?: Varietal;          // of varietal
  weighTags?: WeighTag[];       // from block
}

export interface WeighTag extends BaseNode {
  tagNumber: string;
  weightLbs: number;
  vintage: number;
  blockId?: string; // link to block
  composition: Composition;
}
