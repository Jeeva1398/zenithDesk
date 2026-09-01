import { Navigate, Outlet } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';

function CustomerProtectedRoute() {
  const { isAuthenticated } = useCustomerAuth();

  if (!isAuthenticated) {
    return <Navigate to="/portal/login" replace />;
  }

  return <Outlet />;
}

export default CustomerProtectedRoute;
