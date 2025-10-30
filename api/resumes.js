import { db } from '../../lib/sqlite-db.js';

export default function handler(req, res) {
  const rows = db.prepare('SELECT * FROM resumes ORDER BY uploaded_at DESC').all();
  res.status(200).json(rows);
}
