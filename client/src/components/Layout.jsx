import { useState } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import Sidebar from './Sidebar';
import ViewsPanel from './ViewsPanel';
import SearchBar from './SearchBar';
import ThemeToggle from './ThemeToggle';

function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const onTickets = Boolean(useMatch('/tickets/*'));

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {onTickets && (
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-16 lg:z-20 lg:flex lg:w-56 lg:flex-col lg:border-r lg:border-gray-200">
          <ViewsPanel />
        </aside>
      )}

      <div className={`flex min-h-screen flex-col ${onTickets ? 'lg:pl-72' : 'lg:pl-16'}`}>
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path
                fillRule="evenodd"
                d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <SearchBar />
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
