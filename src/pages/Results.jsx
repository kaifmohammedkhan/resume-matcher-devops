import { useLocation, Link } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { highlightKeywords } from '../utils/highlightKeywords';
import Footer from '../components/Footer';

function Results() {
  const { state } = useLocation();
  const jobs = state?.jobs || [];
  const keywords = state?.keywords || [];

  const normalizedKeywords = useMemo(
    () => keywords.map(k => k.toLowerCase()),
    [keywords]
  );

  const [minScore, setMinScore] = useState(1);
  const [sortBy, setSortBy] = useState('score');
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 10;

  const getMatchScore = (description = '', fallback = '') => {
    const lowerDesc = (description || fallback).toLowerCase();
    return normalizedKeywords.filter(k => lowerDesc.includes(k)).length;
  };

  const filteredJobs = jobs.filter(job => {
    const score = getMatchScore(job.job_description, job.title);
    return score >= minScore;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'score') {
      return (
        getMatchScore(b.job_description, b.title) -
        getMatchScore(a.job_description, a.title)
      );
    }
    if (sortBy === 'date') {
      return new Date(b.job_posted_at_datetime_utc) - new Date(a.job_posted_at_datetime_utc);
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedJobs.length / jobsPerPage);
  const paginatedJobs = sortedJobs.slice(
    (currentPage - 1) * jobsPerPage,
    currentPage * jobsPerPage
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const hasAnyMatch = sortedJobs.length > 0;
  const sectionLabel = 'Matched Jobs';

  return (
    <>
      <nav className="w-full bg-dark border-b border-gray-700 px-6 py-4 flex justify-between items-center text-white font-sans">
        <h1 className="text-xl font-bold text-accent">Resume Matcher</h1>
        <div className="flex gap-6 text-sm">
          <Link to="/" className="hover:text-yellow-300 transition">Home</Link>
          <Link to="/about" className="hover:text-yellow-300 transition">About</Link>
          <Link to="/connect" className="hover:text-yellow-300 transition">Connect</Link>
        </div>
      </nav>

      <main className="min-h-screen bg-dark text-white px-4 py-8 font-sans">
        <h2 className="text-3xl font-bold text-accent mb-6 text-center">{sectionLabel}</h2>

        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <select
            className="bg-mid text-white px-3 py-2 rounded"
            onChange={(e) => {
              setMinScore(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value="1">Any Match (OR)</option>
            <option value="3">3+ keywords</option>
            <option value="5">5+ keywords</option>
            <option value="10">10+ keywords</option>
          </select>

          <select
            className="bg-mid text-white px-3 py-2 rounded"
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="score">Best Match</option>
            <option value="date">Newest</option>
          </select>
        </div>

        {!hasAnyMatch && (
          <div className="text-center text-yellow-400 mb-6">
            <p className="mb-2 font-semibold">No matching jobs found.</p>
            <p className="text-sm text-gray-400">
              Try lowering the keyword threshold or adjusting filters to broaden your search.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-accent text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-yellow-300 transition"
            >
              Retry Search
            </button>
          </div>
        )}

        <div className="grid gap-6 max-w-4xl mx-auto">
          {paginatedJobs.map((job, index) => {
            const score = getMatchScore(job.job_description, job.title);
            const key = job.job_id || job.job_apply_link || `job-${index}`;
            const matchedKeywords = normalizedKeywords.filter(k =>
              (job.job_description || job.title).toLowerCase().includes(k)
            );

            const sourceLabel = job.company || job.source || 'Unknown';
            const sourceClass = job.source?.toLowerCase() === 'linkedin'
              ? 'bg-blue-500 text-white'
              : job.source?.toLowerCase() === 'indeed'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-500 text-white';

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-mid rounded-xl p-6 shadow-lg"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold text-accent">
                    {job.job_title || job.title || 'Untitled Role'}
                  </h3>
                  <span className="text-sm bg-accent text-black px-3 py-1 rounded-full font-bold">
                    {score} keyword{score !== 1 ? 's' : ''}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-2">
                  Source: <span className={`px-2 py-1 rounded-full font-semibold ${sourceClass}`}>
                    {sourceLabel}
                  </span>
                </p>

                <div
                  className="text-sm text-gray-400 mb-2"
                  dangerouslySetInnerHTML={{
                    __html: highlightKeywords(
                      (job.job_description || job.title).slice(0, 200),
                      normalizedKeywords
                    )
                  }}
                />

                <p className="text-xs text-gray-500 mb-4">
                  Matched: {matchedKeywords.join(', ')}
                </p>

                <a
                  href={job.job_apply_link || job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-block px-4 py-2 rounded-full font-bold text-sm transition ${
                    (job.job_apply_link || job.url)
                      ? 'bg-accent text-black hover:bg-yellow-300'
                      : 'bg-gray-500 text-gray-300 cursor-not-allowed pointer-events-none'
                  }`}
                  onClick={(e) => {
                    if (!job.job_apply_link && !job.url) e.preventDefault();
                  }}
                >
                  {(job.job_apply_link || job.url) ? 'Apply Now' : 'Link Unavailable'}
                </a>
              </motion.div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                aria-label={`Go to page ${i + 1}`}
                className={`px-3 py-1 rounded ${
                  currentPage === i + 1
                    ? 'bg-accent text-black font-bold'
                    : 'bg-mid text-white hover:bg-gray-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

export default Results;
