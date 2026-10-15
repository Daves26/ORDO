import { revalidateTag } from "next/cache";

/** Invalidate only the minute-long dashboard/list snapshots after a committed write. */
export function invalidateReadModels() {
  revalidateTag("dashboard", "max");
  revalidateTag("sales-list", "max");
}
