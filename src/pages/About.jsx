import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

export default function About() {
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

      {/* Main Content */}
      <main className="min-h-screen bg-dark text-white px-6 py-12 font-sans">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-accent mb-4">About This Platform</h2>
          <p className="text-gray-400 text-md leading-relaxed">
            This platform helps job seekers discover active roles by matching their resumes against live job listings.
            It uses keyword extraction, semantic filtering, and recruiter-grade scoring to surface the most relevant opportunities.
            Whether you're targeting LinkedIn or broader sources, the engine adapts to your preferences and highlights roles that match your skills.
            
                             Note: upload Resume in PDF format only (not Word etc.)
          </p>
          <p className="text-gray-500 text-sm mt-6">
            Built for precision. Designed for visibility. Powered by automation.
          </p>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}
