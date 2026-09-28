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
    // Capped width: the header only needs room for a search term, not the page's
    // full width; the space to its right stays empty.
    <form onSubmit={handleSubmit} className="relative w-full max-w-md" role="search">
      <label className="sr-only" htmlFor="global-search">
        Search tickets and customers
      </label>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        id="global-search"
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search tickets, customers, tags or #id"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      />
    </form>
  );
}

export default SearchBar;
