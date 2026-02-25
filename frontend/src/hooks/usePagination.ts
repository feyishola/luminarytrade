export const usePagination = <T>(
  data: T[],
  page: number,
  pageSize: number
) => {
  const total = data.length;
  const totalPages = Math.ceil(
    total / pageSize
  );

  const paginated = data.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return {
    paginated,
    totalPages,
    total,
  };
};