import { db } from '../../lib/sqlite-db.js';

export default function handler(req, res) {
  try {
    // ✅ Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ✅ Add a safe limit to prevent DoS from huge result sets
    const limit = 50; // adjust as needed
    const stmt = db.prepare('SELECT * FROM resumes ORDER BY uploaded_at DESC LIMIT ?');
    const rows = stmt.all(limit);

    // ✅ Return safe JSON response
    res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Resume query failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
