import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentUser();
  if (!actor) redirect("/login");
  return <Shell actor={actor}>{children}</Shell>;
}
