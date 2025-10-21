import { FaArrowUp } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="w-full bg-dark border-t border-gray-700 text-center text-xs text-gray-500 py-6 font-sans">
      <p className="mb-2">
        © {new Date().getFullYear()} Kaif Mohammed Khan. All rights reserved.
      </p>

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="inline-flex items-center gap-1 text-accent hover:text-yellow-300 transition"
      >
        <FaArrowUp />
        Back to top
      </button>
    </footer>
  );
}
