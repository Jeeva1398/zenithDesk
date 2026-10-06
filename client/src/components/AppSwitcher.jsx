import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PRODUCTS, PRODUCT_KEYS } from '../lib/products';

// Which product the page on screen belongs to; shared pages belong to neither.
function productOfPage(pathname, search) {
  if (pathname.startsWith('/tickets')) return 'desk';
  if (pathname.startsWith('/enquiries') || pathname.startsWith('/live-chats')) return 'chat';
  if (pathname === '/dashboard') return new URLSearchParams(search).get('view') === 'chatbot' ? 'chat' : 'desk';
  return null;
}

// Desk and Chat side by side in the header. A product the org does not use
// stays in the switcher, leading to the page that turns it on.
function AppSwitcher() {
  const { hasProduct } = useAuth();
  const { pathname, search } = useLocation();
  const current = pathname.startsWith('/products/') ? pathname.split('/')[2] : productOfPage(pathname, search);

  return (
    <nav aria-label="Products" className="hidden items-center rounded-lg bg-gray-100 p-1 sm:inline-flex">
      {PRODUCT_KEYS.map((key) => {
        const product = PRODUCTS[key];
        const enabled = hasProduct(key);
        const active = current === key;
        return (
          <Link
            key={key}
            to={enabled ? product.home : `/products/${key}`}
            aria-current={active ? 'page' : undefined}
            title={enabled ? product.name : `${product.name}: not in use yet`}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-sm font-medium transition ${
              active ? 'bg-white text-gray-900 shadow-sm' : enabled ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {!enabled && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3.5" aria-hidden="true">
                <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
              </svg>
            )}
            {product.short}
          </Link>
        );
      })}
    </nav>
  );
}

export default AppSwitcher;
