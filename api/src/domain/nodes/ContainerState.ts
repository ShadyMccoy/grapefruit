import { BaseNode } from "./BaseNode";

export interface Composition {
  [component: string]: number; // e.g. { cabernet: 0.7, merlot: 0.3 }
}

export interface ContainerState extends BaseNode {
  containerId: string;         
  volumeLiters: number;        
  composition: Composition;    
  timestamp: Date;             
  isCurrent: boolean;          
  isInitial?: boolean;         
}
