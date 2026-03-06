import { redirect } from "next/navigation";

// La raíz redirige al dashboard (Clerk maneja la autenticación)
export default function Home() {
  redirect("/dashboard");
}
