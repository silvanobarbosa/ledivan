"use server";

import { signIn } from "@/auth";
import { resetDemoFromSource, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";

// Prepara o sandbox (clone fresco do apoiador) e entra na conta demo.
export async function startDemo() {
  await resetDemoFromSource();
  await signIn("credentials", { email: DEMO_EMAIL, password: DEMO_PASSWORD, redirectTo: "/dashboard" });
}
