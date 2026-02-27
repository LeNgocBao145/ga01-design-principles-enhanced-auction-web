export const getPaginationRange = (currentPage, totalPages) => {
  const range = [];
  const maxVisible = 4;
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++)
      range.push({ number: i, type: "number" });
  } else {
    range.push({ number: 1, type: "number" });
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) range.push({ type: "ellipsis" });
    for (let i = start; i <= end; i++)
      range.push({ number: i, type: "number" });
    if (end < totalPages - 1) range.push({ type: "ellipsis" });
    range.push({ number: totalPages, type: "number" });
  }
  return range;
};

export const getBaseInformationPagination = (total, page, limit) => {
  const totalCount = parseInt(total) || 0;
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) {
    from = 0;
    to = 0;
  }
  return { from, to, nPages };
};

export const replace = (str, search, replaceWith) => {
  if (!str) return "";
  return str.replace(new RegExp(search, "g"), replaceWith);
};
export const range = (start, end) => {
  const result = [];
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  return result;
};

export const length = (arr) => {
  return Array.isArray(arr) ? arr.length : 0;
};
