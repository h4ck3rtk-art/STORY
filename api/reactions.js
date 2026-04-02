import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === "POST") {
    const { story_id, emoji, session_id } = req.body;
    if (!story_id || !emoji || !session_id) {
      return res.status(400).json({ error: "story_id, emoji, session_id required" });
    }

    const ALLOWED_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👏", "🤔", "💯"];
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({ error: "Invalid emoji" });
    }

    try {
      // Toggle: if exists delete, else insert
      const existing = await sql`
        SELECT id FROM reactions WHERE story_id=${story_id} AND emoji=${emoji} AND session_id=${session_id}
      `;

      let action;
      if (existing.length > 0) {
        await sql`DELETE FROM reactions WHERE story_id=${story_id} AND emoji=${emoji} AND session_id=${session_id}`;
        action = "removed";
      } else {
        await sql`INSERT INTO reactions (story_id, emoji, session_id) VALUES (${story_id}, ${emoji}, ${session_id})`;
        action = "added";
      }

      // Get updated counts
      const counts = await sql`
        SELECT emoji, COUNT(*) as count FROM reactions WHERE story_id=${story_id} GROUP BY emoji
      `;

      // Get user's reactions
      const userReactions = await sql`
        SELECT emoji FROM reactions WHERE story_id=${story_id} AND session_id=${session_id}
      `;

      res.status(200).json({ action, counts, userReactions: userReactions.map(r => r.emoji) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === "GET") {
    const { story_id, session_id } = req.query;
    try {
      const counts = await sql`
        SELECT emoji, COUNT(*) as count FROM reactions WHERE story_id=${story_id} GROUP BY emoji
      `;
      let userReactions = [];
      if (session_id) {
        const ur = await sql`
          SELECT emoji FROM reactions WHERE story_id=${story_id} AND session_id=${session_id}
        `;
        userReactions = ur.map(r => r.emoji);
      }
      res.status(200).json({ counts, userReactions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
