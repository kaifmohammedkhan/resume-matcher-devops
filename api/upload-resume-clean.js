import { Writable } from 'stream';
import formidable from 'formidable';
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
      keepExtensions: true,
      multiples: false,
      fileWriteStreamHandler: () => {
        const chunks = [];
        const writable = new Writable({
          write(chunk, encoding, callback) {
            chunks.push(chunk);
            callback();
          }
        });
        writable.on('finish', function () {
          writable.buffer = Buffer.concat(chunks);
        });
        return writable;
      }
    });

    const [fields, files] = await form.parse(req);
    const resumeFile = files?.resume?.[0];
    const resumeBuffer = resumeFile?._writeStream?.buffer;

    if (!resumeBuffer || !Buffer.isBuffer(resumeBuffer)) {
      console.error('❌ Resume buffer missing or invalid');
      return res.status(400).json({ error: 'Resume file missing or unreadable' });
    }

    const location = fields.location?.[0] || '';
    const workMode = fields.workMode?.[0] || 'All';

    console.log('📄 Resume received in memory');
    console.log('📍 Location:', location);

    const resumeData = await extractResumeText(resumeBuffer);
    const rawText = resumeData.rawText;

    let keywords = extractFrequentKeywords(rawText, 5);

    const titleHint = rawText.match(/(developer|designer|analyst|manager|consultant|engineer|architect|specialist)/i)?.[0];
    if (titleHint && !keywords.includes(titleHint.toLowerCase())) {
      keywords.unshift(titleHint.toLowerCase());
    }

    if (keywords.length < 3) {
      const fallback = extractFrequentKeywords(rawText, 10);
      keywords = [...new Set([...keywords, ...fallback])].slice(0, 5);
    }

    const query = buildOrQuery(keywords);
    console.log('🔍 Query:', query);
    console.log('🔑 Keywords:', keywords);

    const jobs = await scrapeGoogleJobs({ query, location, workMode });
    console.log(`📦 Google scraped jobs: ${jobs.length}`);

    const validJobs = jobs.filter(j => (j.job_description || '').length > 50);
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
