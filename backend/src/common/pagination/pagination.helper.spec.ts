import { PaginationHelper } from "./pagination.helper";

describe('PaginationHelper', () => {
  it('should calculate skip correctly', () => {
    const result = PaginationHelper.getPagination(2, 10);
    expect(result.skip).toBe(10);
  });

  it('should default invalid page to 1', () => {
    const result = PaginationHelper.getPagination(0, 10);
    expect(result.page).toBe(1);
  });

  it('should calculate totalPages correctly', async () => {
    // mock query builder
  });
});