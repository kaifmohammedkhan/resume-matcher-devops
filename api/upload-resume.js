// api/upload-resume.js
import formidable from 'formidable';
import fs from 'fs/promises';

import { scrapeLinkedInJobs } from '../../server/scrapeLinkedInJobs.js';
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
    const filePath = files.resume[0].filepath;
    const location = fields.location?.[0] || '';
    const workMode = fields.workMode?.[0] || 'All';
    const source = fields.source?.[0] || 'All';

    const resumeData = await extractResumeText(filePath);
    const rawText = resumeData.rawText;

    let keywords = extractFrequentKeywords(rawText, 5);
    if (keywords.length < 3) {
      keywords.push('recruiter', 'cybersecurity', 'manager', 'staffing', 'compliance');
    }

    const query = buildOrQuery(keywords);
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
    console.error('Resume scrape failed:', err);
    res.status(500).json({ error: 'Resume processing failed' });
  }
}
