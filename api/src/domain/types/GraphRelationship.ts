// src/domain/types/GraphRelationship.ts
export interface GraphRelationship<TFrom, TTo, TProps = {}> {
  from: TFrom;
  to: TTo;
  props: TProps;
}
