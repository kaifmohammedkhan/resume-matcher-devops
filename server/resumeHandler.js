import { extractResumeText } from './extractResumeText.js';
import { extractSmartKeywords } from './extractSmartKeywords.js';
import { scrapeGoogleJobs } from './scrapeGoogleJobs.js';

export async function handleResumeUpload(filePath, location = '', workMode = 'All') {
  const rawText = await extractResumeText(filePath);
  const keywords = extractSmartKeywords(rawText);
  const jobs = await scrapeGoogleJobs(keywords, location, workMode);

  return jobs;
}
