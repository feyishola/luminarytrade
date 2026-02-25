export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'between';

export type FilterLogic = 'AND' | 'OR';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface FilterGroup {
  logic: FilterLogic;
  conditions: FilterCondition[];
}