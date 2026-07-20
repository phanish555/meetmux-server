function applyFilters(items, filters, handlers) {
  return Object.entries(filters).reduce((acc, [key, value]) => {
    const handler = handlers[key];
    return handler ? acc.filter((item) => handler(item, value)) : acc;
  }, items);
}

function applySearch(items, term, fields) {
  if (!term) return items;
  const needle = term.toLowerCase();
  return items.filter((item) =>
    fields.some((f) => String(item[f] ?? '').toLowerCase().includes(needle))
  );
}

function applySort(items, sort) {
  return [...items].sort((a, b) => {
    for (const { field, direction } of sort) {
      const av = a[field];
      const bv = b[field];
      if (av === bv) continue;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      const cmp = av > bv ? 1 : -1;
      return direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

function applyFields(items, fields) {
  if (!fields) return items;
  return items.map((item) =>
    fields.reduce((acc, f) => {
      if (f in item) acc[f] = item[f];
      return acc;
    }, {})
  );
}

function buildMeta({ page, limit, total, sort, filters }) {
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    sort: sort.map((s) => `${s.direction === 'desc' ? '-' : ''}${s.field}`).join(','),
    filters,
  };
}

module.exports = { applyFilters, applySearch, applySort, applyFields, buildMeta };
