import { SelectQueryBuilder } from 'typeorm';
import { PaginationParams } from './pagination-params.dto';
import { PaginatedResponse } from './paginated-response.type';

export class PaginationHelper {
  static getPagination(page: number, limit: number) {
    const validatedPage = page && page > 0 ? page : 1;
    const validatedLimit = limit && limit > 0 ? limit : 20;

    const skip = (validatedPage - 1) * validatedLimit;

    return {
      page: validatedPage,
      limit: validatedLimit,
      skip,
    };
  }

  static async paginate<T>(
    queryBuilder: SelectQueryBuilder<T>,
    params: PaginationParams,
  ): Promise<PaginatedResponse<T>> {
    const { page, limit, skip } = this.getPagination(
      params.page,
      params.limit,
    );

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }
}