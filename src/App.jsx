import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import JobDetail from './pages/JobDetail';
import About from './pages/About';       // ✅ New
import Connect from './pages/Connect';   // ✅ New

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/results" element={<Results />} />
        <Route path="/job/:id" element={<JobDetail />} />
        <Route path="/about" element={<About />} />       {/* ✅ New */}
        <Route path="/connect" element={<Connect />} />   {/* ✅ New */}
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;
