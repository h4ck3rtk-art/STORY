import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === "GET") {
    try {
      const { admin } = req.query;
      let stories;
      if (admin === "true") {
        stories = await sql`
          SELECT s.*, 
            COALESCE(json_agg(json_build_object('emoji', r.emoji, 'count', r.cnt)) FILTER (WHERE r.emoji IS NOT NULL), '[]') as reactions,
            COALESCE((SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id), 0) as views
          FROM stories s
          LEFT JOIN (
            SELECT story_id, emoji, COUNT(*) as cnt FROM reactions GROUP BY story_id, emoji
          ) r ON r.story_id = s.id
          GROUP BY s.id
          ORDER BY s.created_at DESC
        `;
      } else {
        stories = await sql`
          SELECT s.*, 
            COALESCE(json_agg(json_build_object('emoji', r.emoji, 'count', r.cnt)) FILTER (WHERE r.emoji IS NOT NULL), '[]') as reactions,
            COALESCE((SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id), 0) as views
          FROM stories s
          LEFT JOIN (
            SELECT story_id, emoji, COUNT(*) as cnt FROM reactions GROUP BY story_id, emoji
          ) r ON r.story_id = s.id
          WHERE s.published = true
          GROUP BY s.id
          ORDER BY s.created_at DESC
        `;
      }
      res.status(200).json(stories);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === "POST") {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { title, content, cover_emoji, category, author, published } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content required" });

    try {
      const [story] = await sql`
        INSERT INTO stories (title, content, cover_emoji, category, author, published)
        VALUES (${title}, ${content}, ${cover_emoji || "📖"}, ${category || "General"}, ${author || "Admin"}, ${published !== false})
        RETURNING *
      `;
      res.status(201).json(story);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
