export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export const sortData = <T>(
  data: T[],
  sorters: SortConfig[]
): T[] => {
  return [...data].sort((a, b) => {
    for (const sorter of sorters) {
      const valA = (a as any)[sorter.key];
      const valB = (b as any)[sorter.key];

      if (valA < valB)
        return sorter.direction === 'asc' ? -1 : 1;

      if (valA > valB)
        return sorter.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
};