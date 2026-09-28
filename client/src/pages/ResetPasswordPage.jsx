import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { labelClass, primaryButtonClass } from '../lib/ui';
import Logo from '../components/Logo';
import PasswordInput from '../components/PasswordInput';
import ThemeToggle from '../components/ThemeToggle';

const MIN_LENGTH = 8;

// Reached from the link in the reset email: /reset-password?token=...
function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  let body;
  if (!token) {
    body = (
      <p className="mt-3 text-sm text-gray-600">
        This page needs the link from your reset email.{' '}
        <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
          Ask for a new link
        </Link>
        .
      </p>
    );
  } else if (done) {
    body = (
      <div role="status">
        <p className="mt-3 text-sm text-gray-600">
          Your password has been changed, and you&apos;ve been signed out everywhere else.
        </p>
        <Link to="/login" className={`${primaryButtonClass} mt-5 w-full`}>
          Log in
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <p className="mb-6 text-sm text-gray-500">Choose a new password for your account.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className={labelClass}>
              New password
            </label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-gray-400">At least {MIN_LENGTH} characters.</p>
          </div>
          <div>
            <label htmlFor="confirm" className={labelClass}>
              Confirm new password
            </label>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
              {/expired|invalid/i.test(error) && (
                <>
                  {' '}
                  <Link to="/forgot-password" className="font-medium underline">
                    Get a new link
                  </Link>
                </>
              )}
            </p>
          )}

          <button type="submit" disabled={submitting} className={`${primaryButtonClass} mt-1`}>
            {submitting ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" stacked />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-gray-900">Set a new password</h1>
          {body}
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
