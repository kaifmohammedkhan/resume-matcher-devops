import path from 'path';
import formidable from 'formidable';
import fs from 'fs/promises';

import { scrapeLinkedInJobs } from '../lib/scrapeLinkedInJobs_v2.js';
import { scrapeGoogleJobs } from '../lib/scrapeGoogleJobs.js';
import { extractResumeText } from '../lib/extractResumeText.js';
import { scoreJobs } from '../lib/semanticMatch.js';
import { extractFrequentKeywords } from '../lib/extractFrequentKeywords.js';
import { buildOrQuery } from '../lib/buildOrQuery.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const form = formidable({
      uploadDir: path.join(process.cwd(), 'tmp'),
      keepExtensions: true,
      multiples: false,
    });

    const [fields, files] = await form.parse(req);
    const resumeFile = files?.resume?.[0];

    if (!resumeFile?.filepath) {
      console.error('❌ No resume file path found');
      return res.status(400).json({ error: 'Resume file missing or unreadable' });
    }

    const filePath = resumeFile.filepath;
    const location = fields.location?.[0] || '';
    const workMode = fields.workMode?.[0] || 'All';
    const source = fields.source?.[0] || 'All';

    console.log('📄 Resume path:', filePath);
    console.log('📍 Location:', location);
    console.log('🌐 Source:', source);

    try {
      await fs.access(filePath);
    } catch {
      console.error('❌ Resume file not found at:', filePath);
      return res.status(404).json({ error: 'Resume file not found' });
    }

    const resumeData = await extractResumeText(filePath);
    const rawText = resumeData.rawText;

    let keywords = extractFrequentKeywords(rawText, 5);

    // ✅ Optional: Role hinting from resume text
    const titleHint = rawText.match(/(developer|designer|analyst|manager|consultant|engineer|architect|specialist)/i)?.[0];
    if (titleHint && !keywords.includes(titleHint.toLowerCase())) {
      keywords.unshift(titleHint.toLowerCase());
    }

    // ✅ Dynamic fallback if keywords are weak
    if (keywords.length < 3) {
      const fallback = extractFrequentKeywords(rawText, 10);
      keywords = [...new Set([...keywords, ...fallback])].slice(0, 5);
    }

    const query = buildOrQuery(keywords);
    console.log('🔍 Query:', query);
    console.log('🔑 Keywords:', keywords);

    const scrapeTasks = [];

    if (source === 'All' || source === 'LinkedIn') {
      scrapeTasks.push(scrapeLinkedInJobs(query, location, workMode));
    }
    if (source === 'All' || source === 'Google') {
      scrapeTasks.push(scrapeGoogleJobs(query, location, workMode));
    }

    const results = await Promise.allSettled(scrapeTasks);

    results.forEach((r, i) => {
      const label = i === 0 ? 'LinkedIn' : 'Google';
      const jobs = Array.isArray(r.value) ? r.value : r.value?.jobs || [];
      console.log(`🔍 ${label} scraper →`, r.status, jobs.length);
    });

    const allJobs = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => Array.isArray(r.value) ? r.value : r.value?.jobs || []);

    console.log(`📦 All scraped jobs: ${allJobs.length}`);

    const validJobs = allJobs.filter(j => (j.job_description || '').length > 50);
    console.log(`✅ Valid jobs after filtering: ${validJobs.length}`);

    const scoredJobs = await scoreJobs(rawText, validJobs);

    scoredJobs.forEach(j => {
      const score = typeof j.score === 'number' ? j.score.toFixed(3) : 'N/A';
      console.log(`🔢 ${j.title} → ${score}`);
    });

    res.status(200).json({ keywords, query, jobs: scoredJobs });
  } catch (err) {
    console.error('❌ Resume scrape failed:', err.message);
    res.status(500).json({ error: 'Resume processing failed' });
  }
}
