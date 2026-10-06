import { redirect } from "next/navigation";
import { homeFor } from "@/features/shell/nav";
import { getContext } from "@/server/auth/session";

export default async function Home() {
  const ctx = await getContext();
  redirect(ctx ? homeFor(ctx.role) : "/login");
}
