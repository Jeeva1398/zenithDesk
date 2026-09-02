import { useEffect } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ViewsPanel from './ViewsPanel';
import { navItemActiveClass, navItemClass, navItemDisabledClass } from '../lib/ui';

const ICONS = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.5a.75.75 0 0 0 1.5 0v-8.5ZM6 6.25a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5ZM15.5 9.25a.75.75 0 0 0-1.5 0v2a.75.75 0 0 0 1.5 0v-2Z" />
      <path
        fillRule="evenodd"
        d="M2 15.25V4.75A2.75 2.75 0 0 1 4.75 2h10.5A2.75 2.75 0 0 1 18 4.75v10.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25ZM4.75 3.5c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V4.75c0-.69-.56-1.25-1.25-1.25H4.75Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  tickets: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path
        fillRule="evenodd"
        d="M4.5 2A1.5 1.5 0 0 0 3 3.5v2.879a.75.75 0 0 0 .22.53l.5.5a.5.5 0 0 1 0 .707l-.5.5a.75.75 0 0 0-.22.53V11.5a1.5 1.5 0 0 0 1.5 1.5h.5v3.5a.75.75 0 0 0 1.28.53l1.72-1.72 1.72 1.72a.75.75 0 0 0 1.06 0L11.5 15.28l1.72 1.72A.75.75 0 0 0 14.5 16.5V13h.5a1.5 1.5 0 0 0 1.5-1.5V8.146a.75.75 0 0 0-.22-.53l-.5-.5a.5.5 0 0 1 0-.707l.5-.5a.75.75 0 0 0 .22-.53V3.5A1.5 1.5 0 0 0 15 2H4.5Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  customers: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.41-1.41a7.002 7.002 0 0 0-13.076.003Z" />
    </svg>
  ),
  settings: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { label: 'Tickets', to: '/tickets', icon: 'tickets' },
  { label: 'Customers', to: null, icon: 'customers' },
  { label: 'Settings', to: null, icon: 'settings' },
];

function useTicketsActive() {
  return Boolean(useMatch('/tickets/*'));
}

function isItemActive(item, pathname, ticketsActive) {
  if (item.to === '/tickets') return ticketsActive;
  return item.to !== null && pathname === item.to;
}

// Icon-only rail — desktop.
function IconRail() {
  const ticketsActive = useTicketsActive();
  const { pathname } = useLocation();
  const { agent, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initial = agent?.name?.charAt(0).toUpperCase() || '?';

  return (
    <div className="flex h-full w-16 flex-col items-center border-r border-gray-200 bg-white py-4">
      <Link
        to="/tickets"
        className="mb-6 flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
      >
        Z
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(item, pathname, ticketsActive);
          if (!item.to) {
            return (
              <div
                key={item.label}
                title={`${item.label} (coming soon)`}
                aria-disabled="true"
                className="flex size-10 cursor-not-allowed items-center justify-center rounded-lg text-gray-300"
              >
                {ICONS[item.icon]}
              </div>
            );
          }
          return (
            <Link
              key={item.label}
              to={item.to}
              title={item.label}
              className={`flex size-10 items-center justify-center rounded-lg transition ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {ICONS[item.icon]}
            </Link>
          );
        })}
      </nav>

      {agent && (
        <button
          type="button"
          onClick={handleLogout}
          title={`Log out (${agent.name})`}
          className="flex size-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 hover:ring-2 hover:ring-indigo-200"
        >
          {initial}
        </button>
      )}
    </div>
  );
}

// Full labeled nav + views — mobile drawer.
function MobileSidebarContent() {
  const ticketsActive = useTicketsActive();
  const { pathname } = useLocation();
  const { agent, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initial = agent?.name?.charAt(0).toUpperCase() || '?';

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          Z
        </div>
        <span className="text-base font-semibold text-gray-900">ZenithDesk</span>
      </div>

      <div className="px-3">
        <nav className="mb-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            if (!item.to) {
              return (
                <div key={item.label} className={navItemDisabledClass} aria-disabled="true">
                  {ICONS[item.icon]}
                  {item.label}
                  <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Soon
                  </span>
                </div>
              );
            }
            const isActive = isItemActive(item, pathname, ticketsActive);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={isActive ? navItemActiveClass : navItemClass}
              >
                {ICONS[item.icon]}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto border-t border-gray-100">
        <ViewsPanel />
      </div>

      {agent && (
        <div className="border-t border-gray-100 p-3">
          <p className="truncate px-3 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            {agent.orgName || 'Your organization'}
          </p>
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {initial}
            </div>
            <span className="truncate text-sm font-medium text-gray-700">{agent.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="ml-auto rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <path
                  fillRule="evenodd"
                  d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M6 10a.75.75 0 0 1 .75-.75h9.69l-2.22-2.22a.75.75 0 1 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 1 1-1.06-1.06l2.22-2.22H6.75A.75.75 0 0 1 6 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex">
        <IconRail />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <div className="relative flex w-72 max-w-[85%] flex-col border-r border-gray-200 shadow-xl">
            <MobileSidebarContent />
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
