import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePath } from '../lib/products';

// Pages of a product the org does not have lead to that product's page, where
// an admin can turn it on, rather than to a screen of 403s.
function RequireProduct({ product }) {
  const { hasProduct } = useAuth();
  if (!hasProduct(product)) {
    return <Navigate to={`/products/${product}`} replace />;
  }
  return <Outlet />;
}

// The portal's front door: wherever the org's first product opens.
export function HomeRedirect() {
  const { isAuthenticated, products } = useAuth();
  return <Navigate to={isAuthenticated ? homePath(products) : '/login'} replace />;
}

export default RequireProduct;
