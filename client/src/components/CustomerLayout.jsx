import { Outlet, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';

function CustomerLayout() {
  const { orgName, logout } = useCustomerAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/portal/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              Z
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{orgName || 'Support'}</p>
              <p className="text-xs text-gray-400">Customer portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default CustomerLayout;
