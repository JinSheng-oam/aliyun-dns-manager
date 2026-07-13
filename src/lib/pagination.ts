export interface PageResult<T> {
  items: T[];
  totalCount?: number;
}

export async function collectAllPages<T>(
  pageSize: number,
  fetchPage: (pageNumber: number, pageSize: number) => Promise<PageResult<T>>
): Promise<T[]> {
  const allItems: T[] = [];
  let pageNumber = 1;

  while (true) {
    const page = await fetchPage(pageNumber, pageSize);
    allItems.push(...page.items);

    if (page.items.length === 0) break;
    if (page.totalCount !== undefined && allItems.length >= page.totalCount) break;
    if (page.items.length < pageSize) break;

    pageNumber += 1;
  }

  return allItems;
}
