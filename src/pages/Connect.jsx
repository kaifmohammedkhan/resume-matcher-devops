import { Link } from 'react-router-dom';
import { FaGithub, FaLinkedin, FaInstagram, FaEnvelope } from 'react-icons/fa';
import Footer from '../components/Footer';

export default function Connect() {
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
          <h2 className="text-3xl font-bold text-accent mb-4">Connect with Me</h2>
          <p className="text-gray-400 text-md mb-6">
            Follow or reach out through any of the platforms below:
          </p>

          <div className="flex justify-center gap-8 text-accent text-3xl">
            <a
              href="mailto:kaifkhanmohammed718@gmail.com"
              className="hover:text-yellow-300 transition"
              aria-label="Email"
            >
              <FaEnvelope />
            </a>
            <a
              href="https://www.linkedin.com/in/kaifmohammedkhan"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow-300 transition"
              aria-label="LinkedIn"
            >
              <FaLinkedin />
            </a>
            <a
              href="https://github.com/kaifmohammedkhan"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow-300 transition"
              aria-label="GitHub"
            >
              <FaGithub />
            </a>
            <a
              href="https://www.instagram.com/kaifmohammedkhan/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow-300 transition"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}
