import * as jsonLogic from 'json-logic-js';

export class PolicyEngine {
  evaluate(condition: any, context: any): boolean {
    if (!condition) return true;
    return jsonLogic.apply(condition, context);
  }
}