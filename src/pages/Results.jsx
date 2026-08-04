import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Footer from '../components/Footer';

export function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve state passed via React Router navigation
  const jobs = location.state?.jobs || [];
  const keywords = location.state?.keywords || [];

  const [minMatches, setMinMatches] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Process and score jobs based on matched keywords
  const processedJobs = useMemo(() => {
    return jobs.map((job) => {
      const description = (job.job_description || '').toLowerCase();
      const matchedCount = keywords.reduce((acc, kw) => {
        return description.includes(kw.toLowerCase()) ? acc + 1 : acc;
      }, 0);

      return {
        ...job,
        matchCount: matchedCount,
      };
    });
  }, [jobs, keywords]);

  // Filter jobs by minimum keyword matches
  const filteredJobs = useMemo(() => {
    return processedJobs.filter((job) => job.matchCount >= minMatches);
  }, [processedJobs, minMatches]);

  // Paginate results
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredJobs.slice(start, start + itemsPerPage);
  }, [filteredJobs, currentPage]);

  const handleFilterChange = (e) => {
    setMinMatches(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 py-4 px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight text-indigo-600">
            <Link to="/">Resume Matcher</Link>
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl font-semibold">Matched Jobs</h2>

          <div className="flex items-center gap-2">
            <label htmlFor="min-matches-filter" className="text-sm font-medium text-gray-700">
              Filter by minimum keyword matches:
            </label>
            <select
              id="min-matches-filter"
              aria-label="filter by minimum keyword matches"
              value={minMatches}
              onChange={handleFilterChange}
              className="border border-gray-300 rounded-md p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={0}>All Matches</option>
              <option value={1}>1+ Matches</option>
              <option value={2}>2+ Matches</option>
              <option value={3}>3+ Matches</option>
              <option value={5}>5+ Matches</option>
              <option value={10}>10+ Matches</option>
            </select>
          </div>
        </div>

        {paginatedJobs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
            <p className="text-gray-600 mb-4">No matching jobs found.</p>
            <button
              onClick={() => navigate('/')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Retry Search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedJobs.map((job) => (
              <div
                key={job.job_id}
                className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">{job.job_title}</h3>
                  <p className="text-sm text-gray-600">
                    {job.company} {job.source && `• via ${job.source}`}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-2">{job.job_description}</p>
                  <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {job.matchCount} {job.matchCount === 1 ? 'keyword' : 'keywords'}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  {job.job_apply_link ? (
                    <a
                      href={job.job_apply_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                    >
                      Apply Now
                    </a>
                  ) : (
                    <span className="inline-block bg-gray-100 text-gray-400 text-sm font-medium py-2 px-4 rounded-md cursor-not-allowed">
                      Link Unavailable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default Results;