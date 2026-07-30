import { Writable } from 'node:stream';
import { formidable } from 'formidable'; 
import path from 'node:path';
import { scrapeGoogleJobs } from '../lib/scrapeGoogleJobs.js';
import { extractResumeText } from '../lib/extractResumeText.js';
import { scoreJobs } from '../lib/semanticMatch.js';
import { extractFrequentKeywords } from '../lib/extractFrequentKeywords.js';
import { buildOrQuery } from '../lib/buildOrQuery.js';

export const config = { api: { bodyParser: false } };

const normalizeText = (text) =>
  text.replace(/\s+/g, ' ').replace(/[\u0000-\u001F]+/g, '').trim();

const findEmail = (text) => {
  const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  return text.match(emailRegex)?.[0] || null;
};

const getBestName = (text, extractedName) => {
  if (extractedName && extractedName.length < 30 && !extractedName.includes('|')) {
    return extractedName.trim();
  }
  let header = text.substring(0, 100);
  const stops = ['|', '•', '·', ',', ' Hyderabad', ' India', ' kaifkhan', ' github', ' linkedin'];
  let cleanName = header;
  stops.forEach(stop => {
    const index = cleanName.toLowerCase().indexOf(stop.toLowerCase());
    if (index !== -1) cleanName = cleanName.substring(0, index);
  });
  return cleanName.trim().substring(0, 50);
};

const getKeywords = (text) => {
  let kw = extractFrequentKeywords(text, 5);
  const title = text.match(/(developer|designer|analyst|manager|consultant|engineer|architect|specialist)/i)?.[0];
  if (title && !kw.includes(title.toLowerCase())) kw.unshift(title.toLowerCase());
  return kw.length < 3
    ? [...new Set([...kw, ...extractFrequentKeywords(text, 10)])].slice(0, 5)
    : kw;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Explicitly restrict uploads to memory only
  const form = formidable({
    multiples: false,
    uploadDir: undefined, // no disk writes
    fileWriteStreamHandler: () => {
      const chunks = [];
      const writable = new Writable({
        write(chunk, encoding, callback) { chunks.push(chunk); callback(); }
      });
      writable.on('finish', () => { writable.buffer = Buffer.concat(chunks); });
      return writable;
    }
  });

  try {
    const [fields, files] = await form.parse(req);
    const resumeFile = files?.resume?.[0];

    if (!resumeFile) {
      console.error('❌ No resume file uploaded');
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    const resumeBuffer = resumeFile?._writeStream?.buffer || null;
    if (!resumeBuffer) {
      console.error('❌ No buffer available from upload');
      return res.status(400).json({ error: 'Could not read uploaded file' });
    }

    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    const fileExt = path.extname(resumeFile.originalFilename || '').toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      console.error('❌ Invalid file extension:', fileExt);
      return res.status(400).json({ error: 'Invalid file type. Allowed: PDF, DOCX, TXT' });
    }

    const location = fields.location?.[0] || '';
    const workMode = fields.workMode?.[0] || 'All';

    // 1. Extraction & Cleaning
    let resumeData;
    try {
      resumeData = await extractResumeText(resumeBuffer);
    } catch (err) {
      console.error('❌ Resume extraction failed:', err);
      return res.status(400).json({ error: 'Resume could not be parsed' });
    }

    const rawText = normalizeText(resumeData.rawText || '');
    const keywords = getKeywords(rawText);
    const query = buildOrQuery(keywords);

    // 2. Matching logic
    let jobs;
    try {
      jobs = await scrapeGoogleJobs({ query, location, workMode });
    } catch (err) {
      console.error('❌ Job scraping failed:', err);
      return res.status(502).json({ error: 'Failed to fetch jobs' });
    }

    const validJobs = jobs.filter(j => (j.job_description || '').length > 50);

    let scoredJobs;
    try {
      scoredJobs = await scoreJobs(rawText, validJobs);
    } catch (err) {
      console.error('❌ Job scoring failed:', err);
      return res.status(500).json({ error: 'Failed to score jobs' });
    }

    // 3. Metadata Extraction
    const detectedEmail = findEmail(rawText) || resumeData.email || `upload-${Date.now()}@example.com`;
    const detectedName = getBestName(rawText, resumeData.name) || 'Unknown Candidate';
    const topScore = scoredJobs.length > 0 ? scoredJobs[0].score : 0;

    // 4. Database Persistence
    try {
      const dbType = process.env.DB_TYPE || 'postgres';
      if (dbType === 'sqlite') {
        const { db: sqliteDb } = await import('../lib/sqlite-db.js');
        const stmt = sqliteDb.prepare(
          'INSERT INTO resumes (name, email, skills, score, match_results) VALUES (?, ?, ?, ?, ?)'
        );
        stmt.run(detectedName, detectedEmail, keywords.join(', '), topScore, JSON.stringify(scoredJobs.slice(0, 10)));
      } else {
        const { pool: pgPool } = await import('../lib/db.js');
        await pgPool.query(
          'INSERT INTO resumes (name, email, skills, score, match_results) VALUES ($1, $2, $3, $4, $5)',
          [detectedName, detectedEmail, keywords.join(', '), topScore, JSON.stringify(scoredJobs.slice(0, 10))]
        );
      }
      console.log(`🚀 [PROD] Results saved for: ${detectedName}`);
    } catch (dbErr) {
      console.error('⚠️ DB Persistence Error:', dbErr);
    }

    return res.status(200).json({
      message: 'Analysis complete',
      candidate: { name: detectedName, email: detectedEmail },
      keywords,
      jobs: scoredJobs
    });
  } catch (err) {
    console.error('❌ System Error:', err);
    return res.status(500).json({ error: 'Unexpected system error' });
  }
}
