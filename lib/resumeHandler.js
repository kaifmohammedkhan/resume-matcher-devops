// lib/resumeHandler.js
import { extractResumeText } from './extractResumeText.js';
import { extractSmartKeywords } from './extractSmartKeywords.js';
import { scrapeGoogleJobs } from './scrapeGoogleJobs.js';

export async function handleResumeUpload(req, res) {
  try {
    const filePath = req?.file?.path || req?.body?.filePath || 'uploads/sample.pdf';
    const rawText = await extractResumeText(filePath);
    const keywords = extractSmartKeywords(rawText);
    const jobs = await scrapeGoogleJobs(keywords, '', 'All');

    if (res && typeof res.json === 'function') {
      return res.json({ keywords, jobs });
    }
    return { keywords, jobs };
  } catch (err) {
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ error: err.message });
    }
    throw err;
  }
}