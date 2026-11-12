export function parseListQuery(query, sortable, defaultSort = 'createdAt') {
  const pageNumber = Math.max(Number(query.page) || 1, 1);
  const take = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * take;
  const orderField = sortable.includes(query.sortBy) ? query.sortBy : defaultSort;
  const orderDirection = query.order === 'asc' ? 'asc' : 'desc';

  return { pageNumber, take, skip, orderField, orderDirection };
}

export function pageMeta(pageNumber, take, total, count) {
  const skip = (pageNumber - 1) * take;
  return {
    page: pageNumber,
    limit: take,
    total,
    totalPages: Math.max(Math.ceil(total / take), 1),
    hasMore: skip + count < total,
  };
}
