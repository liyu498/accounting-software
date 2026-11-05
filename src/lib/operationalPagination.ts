export interface OperationalPage<T> {
  rows: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  start: number;
  end: number;
}

function positiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function paginateOperationalRows<T>(
  rows: readonly T[],
  requestedPage: number,
  requestedPageSize: number,
): OperationalPage<T> {
  const pageSize = positiveInteger(requestedPageSize, 20);
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(totalPages, positiveInteger(requestedPage, 1));
  const offset = (page - 1) * pageSize;

  return {
    rows: rows.slice(offset, offset + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages,
    start: totalItems === 0 ? 0 : offset + 1,
    end: Math.min(offset + pageSize, totalItems),
  };
}
