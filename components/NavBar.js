import { useEffect, useState } from 'react';

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [hideCommunityReporter, setHideCommunityReporter] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/public/feature-toggles', { headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data) {
          setHideCommunityReporter(Boolean(data.communityReporterClosed));
        }
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-2xl font-bold text-blue-700">📰 News Pulse</div>

        {/* Hamburger Icon */}
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-700 focus:outline-none"
          >
            {isOpen ? '✖' : '☰'}
          </button>
        </div>

        {/* Desktop Menu */}
        <ul className="hidden md:flex space-x-6 font-medium text-gray-700">
          <li><a href="/" className="hover:text-blue-600">Home</a></li>
          <li><a href="/editorial" className="hover:text-blue-600">Editorial</a></li>
          <li><a href="/about" className="hover:text-blue-600">About</a></li>
          <li><a href="/contact" className="hover:text-blue-600">Contact</a></li>
          <li><a href="/news" className="text-blue-700 hover:underline">📰 Top News</a></li>
          {!hideCommunityReporter && (
            <li><a href="/community-reporter" className="hover:text-blue-600">Community Reporter</a></li>
          )}
        </ul>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <ul className="md:hidden px-4 pb-4 space-y-2 font-medium text-gray-700 bg-white shadow-inner">
          <li><a href="/" className="block hover:text-blue-600">Home</a></li>
          <li><a href="/editorial" className="block hover:text-blue-600">Editorial</a></li>
          <li><a href="/about" className="block hover:text-blue-600">About</a></li>
          <li><a href="/contact" className="block hover:text-blue-600">Contact</a></li>
          <li><a href="/news" className="block text-blue-700 hover:underline">📰 Top News</a></li>
          {!hideCommunityReporter && (
            <li><a href="/community-reporter" className="block hover:text-blue-600">Community Reporter</a></li>
          )}
        </ul>
      )}
    </nav>
  );
}

