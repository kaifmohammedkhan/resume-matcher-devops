import { Link } from 'react-router-dom';

export default function JobCard({ job }) {
  return (
    <div className="bg-[#2c2f38] text-white rounded-lg shadow-md p-6 flex justify-between items-center hover:bg-[#3d474e] transition">
      <div>
        <h3 className="text-lg font-semibold mb-1">{job.title}</h3>
        <p className="text-sm text-gray-300">
          {job.company} — {job.location}
        </p>
      </div>

      <div className="flex gap-3">
        {/* Internal navigation to detail view */}
        <Link
          to={`/job/${job.id}`}
          className="bg-accent text-dark px-4 py-2 rounded font-semibold text-sm hover:bg-yellow-300 transition"
        >
          View Full Job
        </Link>

        {/* External apply link */}
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-400 text-dark px-4 py-2 rounded font-semibold text-sm hover:bg-green-500 transition"
          >
            Apply Now
          </a>
        ) : (
          <button
            disabled
            className="bg-gray-500 text-dark px-4 py-2 rounded font-semibold text-sm cursor-not-allowed"
          >
            No Link
          </button>
        )}
      </div>
    </div>
  );
}
