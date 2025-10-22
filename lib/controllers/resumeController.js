import { extractResumeText } from '../extractResumeText.js';
import { extractSmartKeywords } from '../extractSmartKeywords.js';
import { scrapeGoogleJobs } from '../scrapeGoogleJobs.js';

export async function handleResumeUpload(req, res) {
  try {
    const filePath = req.file.path; // from multer
    const location = req.body.location || '';
    const workMode = req.body.workMode || 'All';

    const rawText = await extractResumeText(filePath);
    const keywords = extractSmartKeywords(rawText);
    const jobs = await scrapeGoogleJobs(keywords, location, workMode);

    res.json({ keywords, jobs });
  } catch (err) {
    console.error('❌ Resume upload failed:', err.message);
    res.status(500).json({ error: 'Resume processing failed' });
  }
}
