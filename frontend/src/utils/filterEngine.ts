import { FilterGroup } from '../types/filters';

export const applyFilters = <T>(
  data: T[],
  group: FilterGroup
): T[] => {
  if (!group.conditions.length) return data;

  return data.filter((item) => {
    const results = group.conditions.map((cond) => {
      const value = (item as any)[cond.field];

      switch (cond.operator) {
        case 'equals':
          return value === cond.value;

        case 'contains':
          return String(value)
            .toLowerCase()
            .includes(String(cond.value).toLowerCase());

        case 'gt':
          return value > cond.value;

        case 'lt':
          return value < cond.value;

        case 'between':
          return (
            value >= cond.value[0] &&
            value <= cond.value[1]
          );

        default:
          return false;
      }
    });

    return group.logic === 'AND'
      ? results.every(Boolean)
      : results.some(Boolean);
  });
};