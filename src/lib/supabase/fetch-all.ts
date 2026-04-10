const PAGE_SIZE = 1000;

/**
 * Fetches ALL rows from a Supabase query, paginating automatically.
 * The Supabase JS client defaults to returning max 1000 rows.
 * This helper loops with .range() until all rows are retrieved.
 *
 * On query errors, logs and returns whatever was collected so far
 * (matches the original Supabase client behavior of not throwing).
 */
export async function supabaseFetchAll<T = Record<string, unknown>>(
  queryFn: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await queryFn(from, to);

    if (error) {
      console.error("[supabaseFetchAll] Query error:", error);
      break;
    }

    if (!data || data.length === 0) break;

    allData.push(...data);

    // If we got fewer rows than the page size, we've reached the end
    if (data.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allData;
}
