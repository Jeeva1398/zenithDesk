import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/auth';
import { inputClass, labelClass, primaryButtonClass } from '../lib/ui';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" stacked />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-gray-900">Reset your password</h1>
          {sent ? (
            <div role="status">
              <p className="mt-3 text-sm text-gray-600">
                If <span className="font-medium text-gray-900">{email}</span> has an account, we&apos;ve emailed it a
                link to choose a new password. The link works once, for 30 minutes.
              </p>
              <p className="mt-3 text-sm text-gray-500">Nothing arrived? Check your spam folder, or try again.</p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Send another link
              </button>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-gray-500">Enter your email and we&apos;ll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>

                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                <button type="submit" disabled={submitting} className={`${primaryButtonClass} mt-1`}>
                  {submitting ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
