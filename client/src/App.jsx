import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import CustomerLayout from './components/CustomerLayout';
import CustomerProtectedRoute from './components/CustomerProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import SettingsPage from './pages/SettingsPage';
import SearchPage from './pages/SearchPage';
import CustomerLoginPage from './pages/customer/CustomerLoginPage';
import CustomerTicketsPage from './pages/customer/CustomerTicketsPage';
import CustomerTicketDetailPage from './pages/customer/CustomerTicketDetailPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Route>
      </Route>

      <Route path="/portal/login" element={<CustomerLoginPage />} />
      <Route element={<CustomerProtectedRoute />}>
        <Route element={<CustomerLayout />}>
          <Route path="/portal/tickets" element={<CustomerTicketsPage />} />
          <Route path="/portal/tickets/:id" element={<CustomerTicketDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tickets" replace />} />
    </Routes>
  );
}

export default App;
