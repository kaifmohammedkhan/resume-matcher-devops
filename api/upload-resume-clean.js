import { Writable } from 'node:stream';
import { formidable } from 'formidable'; 
import path from 'node:path';
import os from 'node:os';
import { scrapeGoogleJobs } from '../lib/scrapeGoogleJobs.js';
import { extractResumeText } from '../lib/extractResumeText.js';
import { scoreJobs } from '../lib/semanticMatch.js';
import { extractFrequentKeywords } from '../lib/extractFrequentKeywords.js';
import { buildOrQuery } from '../lib/buildOrQuery.js';

export const config = { api: { bodyParser: false } };

const normalizeText = (text) =>
  text.replace(/\s+/g, ' ').replace(/[\u0000-\u001F]+/g, '').trim();

// ✅ Fixed ReDoS/backtracking issue flagged by SonarQube by separating domain labels
const findEmail = (text) => {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/gi;
  return text.match(emailRegex)?.[0] || null;
};

const getBestName = (text, extractedName) => {
  if (extractedName && extractedName.length < 30 && !extractedName.includes('|')) {
    return extractedName.trim();
  }
  let header = text.substring(0, 100);
  const stops = ['|', '•', '·', ',', ' github', ' linkedin'];
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

  // Restrict destination directory to OS temp folder
  const form = formidable({
    multiples: false,
    uploadDir: os.tmpdir(),
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

    // ✅ Extension + MIME type validation
    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const fileExt = path.extname(resumeFile.originalFilename || '').toLowerCase();
    const mimeType = resumeFile.mimetype || '';
    if (!allowedExtensions.includes(fileExt) || !allowedMimes.includes(mimeType)) {
      console.error('❌ Invalid file type:', fileExt, mimeType);
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
      return res.status(400).json({ stage: 'resume_extraction', error: 'Resume could not be parsed' });
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
      return res.status(502).json({ stage: 'job_scraping', error: 'Failed to fetch jobs' });
    }

    const validJobs = jobs.filter(j => (j.job_description || '').length > 50);

    let scoredJobs;
    try {
      scoredJobs = await scoreJobs(rawText, validJobs);
    } catch (err) {
      console.error('❌ Job scoring failed:', err);
      return res.status(500).json({ stage: 'job_scoring', error: 'Failed to score jobs' });
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
    return res.status(500).json({ stage: 'system', error: 'Unexpected system error' });
  }
}