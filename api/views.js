import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === "POST") {
    const { story_id, session_id } = req.body;
    if (!story_id || !session_id) {
      return res.status(400).json({ error: "story_id and session_id required" });
    }

    try {
      // Only count unique views per session
      const existing = await sql`
        SELECT id FROM story_views WHERE story_id=${story_id} AND session_id=${session_id}
      `;
      if (existing.length === 0) {
        await sql`INSERT INTO story_views (story_id, session_id) VALUES (${story_id}, ${session_id})`;
      }

      const [{ count }] = await sql`SELECT COUNT(*) as count FROM story_views WHERE story_id=${story_id}`;
      res.status(200).json({ views: parseInt(count) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
