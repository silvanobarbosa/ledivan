/**
 * Endpoint para sincronizar usuário do Auth0 para o banco Neon
 *
 * Chamado automaticamente após primeiro login com Google
 * para criar registro do usuário no banco local.
 *
 * POST /api/auth/sync-user
 */

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json(
        { error: "Unauthorized - No session" },
        { status: 401 }
      );
    }

    const { email, name, image } = session.user;

    // Criar usuário se não existir (INSERT ... ON CONFLICT DO NOTHING)
    await db.execute(sql`
      INSERT INTO users (email, name, image, role, created_at, updated_at)
      VALUES (
        ${email.toLowerCase()},
        ${name || email.split("@")[0]},
        ${image},
        'user',
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE
      SET
        name = COALESCE(EXCLUDED.name, users.name),
        image = COALESCE(EXCLUDED.image, users.image),
        updated_at = NOW()
    `);

    return Response.json({
      success: true,
      message: "User synced successfully",
      email,
    });
  } catch (error) {
    console.error("[sync-user] Error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
