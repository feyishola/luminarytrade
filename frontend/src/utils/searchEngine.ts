export const searchData = <T>(
  data: T[],
  query: string,
  fields: string[]
): T[] => {
  if (!query) return data;

  const lower = query.toLowerCase();

  return data.filter((item) =>
    fields.some((field) =>
      String((item as any)[field])
        .toLowerCase()
        .includes(lower)
    )
  );
};