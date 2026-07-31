import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Footer from '../components/Footer';

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios
      .get(`/api/job/${id}`)
      .then((res) => setJob(res.data))
      .catch((err) => {
        console.error('❌ Failed to fetch job:', err);
        setError(true);
      });
  }, [id]);

  if (error) {
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

        <div className="bg-dark text-white p-6 min-h-screen">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Job not found</h1>
          <p className="text-sm text-gray-400">Please check the job ID or try again later.</p>
        </div>

        <Footer />
      </>
    );
  }

  if (!job) {
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

        <div className="text-white p-6 min-h-screen flex items-center justify-center">
          <p className="text-sm text-gray-400">Loading job details...</p>
        </div>

        <Footer />
      </>
    );
  }

  const {
    title = 'Untitled Role',
    description = 'No description available.',
    url = '#',
    source = 'External Site'
  } = job;

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="w-full bg-dark border-b border-gray-700 px-6 py-4 flex justify-between items-center text-white font-sans">
        <h1 className="text-xl font-bold text-accent">Resume Matcher</h1>
        <div className="flex gap-6 text-sm">
          <Link to="/" className="hover:text-yellow-300 transition">Home</Link>
          <Link to="/about" className="hover:text-yellow-300 transition">About</Link>
          <Link to="/connect" className="hover:text-yellow-300 transition">Connect</Link>
        </div>
      </nav>

      {/* Job Detail Section */}
      <div className="bg-dark text-white p-6 min-h-screen">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="mb-6 text-gray-300 whitespace-pre-line">{description}</p>
        {url && url !== '#' ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent text-dark px-4 py-2 rounded hover:bg-yellow-300 font-bold text-sm"
          >
            Apply on {source}
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="bg-gray-500 text-dark px-4 py-2 rounded font-bold text-sm cursor-not-allowed"
          >
            No external link available
          </button>
        )}
      </div>

      {/* Footer */}
      <Footer />
    </>
  );
}