import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const [story] = await sql`
        SELECT s.*, 
          COALESCE(json_agg(json_build_object('emoji', r.emoji, 'count', r.cnt)) FILTER (WHERE r.emoji IS NOT NULL), '[]') as reactions,
          COALESCE((SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id), 0) as views
        FROM stories s
        LEFT JOIN (
          SELECT story_id, emoji, COUNT(*) as cnt FROM reactions GROUP BY story_id, emoji
        ) r ON r.story_id = s.id
        WHERE s.id = ${id}
        GROUP BY s.id
      `;
      if (!story) return res.status(404).json({ error: "Story not found" });
      res.status(200).json(story);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === "PUT") {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { title, content, cover_emoji, category, author, published } = req.body;
    try {
      const [story] = await sql`
        UPDATE stories SET
          title = COALESCE(${title}, title),
          content = COALESCE(${content}, content),
          cover_emoji = COALESCE(${cover_emoji}, cover_emoji),
          category = COALESCE(${category}, category),
          author = COALESCE(${author}, author),
          published = COALESCE(${published}, published),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!story) return res.status(404).json({ error: "Story not found" });
      res.status(200).json(story);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === "DELETE") {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      await sql`DELETE FROM stories WHERE id = ${id}`;
      res.status(200).json({ message: "Story deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
