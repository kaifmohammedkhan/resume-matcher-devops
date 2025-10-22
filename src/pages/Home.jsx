import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaUpload } from 'react-icons/fa';
import Footer from '../components/Footer';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState('All');
  const source = 'LinkedIn'; // 🔒 Hardcoded to exclude LinkedIn
  const navigate = useNavigate();

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setFileName(selectedFile.name);
  };

  const handleMatch = async () => {
    if (!file) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('location', location);
      formData.append('workMode', workMode);
      formData.append('source', source);

      const res = await fetch('/api/upload-resume-clean', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error(`Upload failed with ${res.status}`);
      const data = await res.json();

      const jobs = data.jobs || [];
      const keywords = data.keywords || [];

      const scoredJobs = jobs.map(job => {
        const desc = job.job_description?.toLowerCase() || '';
        const score = keywords.filter(k => desc.includes(k)).length;
        return { ...job, matchScore: score };
      });

      const sortedJobs = scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

      navigate('/results', {
        state: {
          jobs: sortedJobs,
          keywords
        }
      });
    } catch (err) {
      console.error('❌ Resume upload failed:', err);
      alert('Failed to process resume');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Main Form Section */}
      <main className="min-h-screen bg-dark text-white flex flex-col items-center justify-center px-4 py-12 font-sans">
        <div className="bg-mid rounded-xl p-8 max-w-md w-full shadow-lg text-center">
          <h2 className="text-3xl font-bold text-accent mb-2">Resume to Active Roles</h2>
          <p className="text-sm text-gray-400 mb-6">Upload your resume to find matching jobs.</p>

          <label className="block text-sm text-gray-300 mb-2">Choose your PDF resume.</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileUpload}
            className="w-full bg-dark border border-gray-600 text-white px-4 py-2 rounded mb-4 cursor-pointer"
          />

          <p className="text-xs text-gray-500 mb-4">
            {fileName ? `Selected: ${fileName}` : 'No file chosen'}
          </p>

          <label className="block text-sm text-gray-300 mb-2">Search Location</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-dark border border-gray-600 text-white px-4 py-2 rounded mb-4"
          >
            <option value="">Global</option>
            <option value="India">India</option>
          </select>

          <label className="block text-sm text-gray-300 mb-2">Work Mode</label>
          <select
            value={workMode}
            onChange={(e) => setWorkMode(e.target.value)}
            className="w-full bg-dark border border-gray-600 text-white px-4 py-2 rounded mb-6"
          >
            <option value="All">All Modes</option>
            <option value="Remote">Remote</option>
            <option value="Onsite">Onsite</option>
            <option value="Hybrid">Hybrid</option>
          </select>

          <button
            disabled={loading || !file}
            onClick={handleMatch}
            className="w-full flex items-center justify-center gap-2 bg-accent text-black px-4 py-2 rounded-full font-bold hover:bg-yellow-300 transition"
          >
            <FaUpload />
            {loading ? 'Matching...' : 'Upload & Match'}
          </button>

          <div className="mt-6 text-center text-xs text-gray-500">
            Built by Kaif Mohammed Khan
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}
