import { redirect } from "next/navigation";

// Middleware routes authenticated users to their role home and everyone else
// to /login; this is only the fallback for a direct hit on "/".
export default function Home() {
  redirect("/login");
}
