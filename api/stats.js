import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const [storyCounts] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE published) as published FROM stories`;
    const [reactionCounts] = await sql`SELECT COUNT(*) as total FROM reactions`;
    const [viewCounts] = await sql`SELECT COUNT(*) as total FROM story_views`;

    const topStories = await sql`
      SELECT s.id, s.title, s.cover_emoji,
        COUNT(DISTINCT r.id) as total_reactions,
        COUNT(DISTINCT sv.id) as total_views
      FROM stories s
      LEFT JOIN reactions r ON r.story_id = s.id
      LEFT JOIN story_views sv ON sv.story_id = s.id
      GROUP BY s.id, s.title, s.cover_emoji
      ORDER BY total_reactions DESC
      LIMIT 5
    `;

    const emojiBreakdown = await sql`
      SELECT emoji, COUNT(*) as count FROM reactions GROUP BY emoji ORDER BY count DESC
    `;

    const recentActivity = await sql`
      SELECT 'reaction' as type, r.emoji as detail, s.title as story_title, r.created_at
      FROM reactions r JOIN stories s ON s.id = r.story_id
      UNION ALL
      SELECT 'view' as type, '' as detail, s.title as story_title, sv.created_at
      FROM story_views sv JOIN stories s ON s.id = sv.story_id
      ORDER BY created_at DESC
      LIMIT 20
    `;

    res.status(200).json({
      stories: { total: parseInt(storyCounts.total), published: parseInt(storyCounts.published) },
      reactions: parseInt(reactionCounts.total),
      views: parseInt(viewCounts.total),
      topStories,
      emojiBreakdown,
      recentActivity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
