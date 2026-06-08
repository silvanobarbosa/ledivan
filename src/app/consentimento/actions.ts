"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function acceptConsent(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const terms = formData.get("terms") === "on";
  const privacy = formData.get("privacy") === "on";
  if (!terms || !privacy) return; // ambos obrigatórios
  const now = new Date();
  await db.update(users).set({ acceptedTermsAt: now, acceptedPrivacyAt: now }).where(eq(users.id, session!.user!.id!));
  redirect("/dashboard");
}
