import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { enableProduct } from '../api/organizations';
import { useAuth } from '../context/AuthContext';
import { PRODUCTS } from '../lib/products';
import { cardClass, primaryButtonClass } from '../lib/ui';

// A product the org does not use yet: what it adds, and for an admin the
// button that turns it on. Nothing is billed yet, so turning it on is all.
function ProductPage() {
  const { product: key } = useParams();
  const product = PRODUCTS[key];
  const { token, agent, hasProduct, refreshOrganization } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!product) return <Navigate to="/" replace />;
  if (hasProduct(product.key)) return <Navigate to={product.home} replace />;

  const isAdmin = agent?.role === 'admin';

  const handleEnable = async () => {
    setSaving(true);
    setError('');
    try {
      await enableProduct(token, product.key);
      await refreshOrganization();
      navigate(product.home);
    } catch (err) {
      setError(err.message || `Could not turn on ${product.name}.`);
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className={`${cardClass} p-6 sm:p-8`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Not in use yet</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">{product.name}</h1>
        <p className="mt-2 text-sm text-gray-600">{product.tagline}</p>

        <ul className="mt-6 space-y-2.5">
          {product.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0 text-emerald-600">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
              {feature}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-gray-500">
          It works with what you already have: the same team, contacts and knowledge base.
        </p>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <button type="button" onClick={handleEnable} disabled={saving} className={primaryButtonClass}>
              {saving ? 'Turning on…' : `Turn on ${product.short}`}
            </button>
          ) : (
            <p className="text-sm text-gray-600">Ask an admin of your organization to turn it on.</p>
          )}
          <Link to="/" className="text-sm font-medium text-gray-500 hover:text-gray-700">
            Not now
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ProductPage;
