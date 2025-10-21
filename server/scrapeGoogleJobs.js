import axios from 'axios';

export async function scrapeGoogleJobs(query = '"developer"', location = '', workMode = 'All') {
  const apiKey = 'AIzaSyBExXAVBbzwhpWmjguzfAp3OxlQPy5ibjk'; // 🔁 Replace with your actual key
  const cx = '7303434811acf48fb'; // 🔁 Replace with your Programmable Search Engine ID

  // 🧼 Sanitize query string
  const sanitizedQuery = typeof query === 'string'
    ? query.replace(/[^a-zA-Z0-9\s\-_."]/g, '').trim()
    : '"developer" OR "engineer" OR "software"';

  const fullQuery = `${sanitizedQuery} ${location}`.trim();
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(fullQuery)}&key=${apiKey}&cx=${cx}`;

  try {
    console.log(`🔍 Google CSE Query: ${fullQuery}`);
    console.log(`🔗 API URL: ${url}`);

    const { data } = await axios.get(url);

    const rawJobs = (data.items || []).map(item => {
      const snippet = item.snippet?.toLowerCase() || '';
      const work_mode = /remote/.test(snippet)
        ? 'Remote'
        : /hybrid/.test(snippet)
        ? 'Hybrid'
        : 'Onsite';

      const job_country = location.toLowerCase().includes('india') ? 'India' : 'Global';

      return {
        title: item.title || 'Untitled Role',
        company: item.displayLink || 'Unknown Company',
        location: location || 'Global',
        url: item.link,
        job_description: snippet.slice(0, 500),
        work_mode,
        job_country,
        source: 'Google'
      };
    });

    const jobs = rawJobs.filter(job => {
      if (!job || !job.job_description || job.job_description.length < 50) return false;
      if (workMode === 'All') return true;
      return job.work_mode.toLowerCase() === workMode.toLowerCase();
    });

    console.log(`✅ Scraped ${jobs.length} jobs from Google CSE`);
    return jobs;
  } catch (err) {
    console.error('❌ Google CSE scraping failed:', err.message);
    return [];
  }
}
