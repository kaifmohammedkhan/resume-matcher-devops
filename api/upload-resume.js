import formidable from 'formidable';
import fs from 'fs/promises';

import { scrapeLinkedInJobs } from '../../server/scrapeLinkedInJobs_v2.js';
import { scrapeGoogleJobs } from '../../server/scrapeGoogleJobs.js';
import { extractResumeText } from '../../server/extractResumeText.js';
import { scoreJobs } from '../../server/semanticMatch.js';
import { extractFrequentKeywords } from '../../server/extractFrequentKeywords.js';
import { buildOrQuery } from '../../server/buildOrQuery.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const form = formidable({ uploadDir: '/tmp', keepExtensions: true });

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

    const resumeData = await extractResumeText(filePath);
    const rawText = resumeData.rawText;

    let keywords = extractFrequentKeywords(rawText, 5);
    if (keywords.length < 3) {
      keywords.push('recruiter', 'cybersecurity', 'manager', 'staffing', 'compliance');
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
    const allJobs = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value || []);

    const validJobs = allJobs.filter(j => (j.job_description || '').length > 50);
    const scoredJobs = await scoreJobs(rawText, validJobs);

    res.status(200).json({ keywords, query, jobs: scoredJobs });
  } catch (err) {
    console.error('❌ Resume scrape failed:', err);
    res.status(500).json({ error: 'Resume processing failed' });
  }
}
