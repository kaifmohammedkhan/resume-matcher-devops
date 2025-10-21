import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="w-full bg-dark border-b border-gray-700 px-6 py-4 flex justify-between items-center text-white font-sans">
      <h1 className="text-xl font-bold text-accent">Resume Matcher</h1>
      <div className="flex gap-6 text-sm">
        <Link to="/" className="hover:text-yellow-300 transition">Home</Link>
        <Link to="/about" className="hover:text-yellow-300 transition">About</Link>
        <Link to="/connect" className="hover:text-yellow-300 transition">Connect</Link>
      </div>
    </nav>
  );
}
