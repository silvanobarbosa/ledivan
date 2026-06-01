import { db } from "@/db";
import { auth } from "@/auth";
import { socialPosts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Generator } from "./Generator";
import { PostCard } from "./PostCard";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const posts = await db.query.socialPosts.findMany({
    where: eq(socialPosts.userId, session.user.id),
    orderBy: [desc(socialPosts.createdAt)],
  });

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Divulgação</h1>
        <p className="text-foreground/50 mt-1">Gere posts para redes sociais com IA e compartilhe.</p>
      </div>

      <Generator />

      <div className="space-y-3">
        {posts.length === 0 ? (
          <p className="text-center py-12 text-foreground/40">Nenhum post ainda. Gere o primeiro acima.</p>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              id={p.id}
              network={p.network}
              theme={p.theme}
              content={p.content}
              hashtags={p.hashtags}
            />
          ))
        )}
      </div>
    </div>
  );
}
