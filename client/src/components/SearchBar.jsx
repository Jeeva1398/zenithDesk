import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Submits to /search rather than searching as you type: results are a page an
// agent can link to and come back to, and it keeps one request per intent
// instead of one per keystroke.
function SearchBar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') || '');

  // Keeps the box in step with the URL, so a back button or a shared link shows
  // the term that produced the results on screen.
  useEffect(() => {
    setTerm(params.get('q') || '');
  }, [params]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const query = term.trim();
    if (query.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1" role="search">
      <label className="sr-only" htmlFor="global-search">
        Search tickets and customers
      </label>
      <input
        id="global-search"
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search tickets, customers, tags or #id"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      />
    </form>
  );
}

export default SearchBar;
