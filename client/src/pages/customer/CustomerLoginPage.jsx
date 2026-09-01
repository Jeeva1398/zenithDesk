import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestOtp, resolveOrg, verifyOtp } from '../../api/customerAuth';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { inputClass, labelClass, primaryButtonClass } from '../../lib/ui';

function CustomerLoginPage() {
  const { login } = useCustomerAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [org, setOrg] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const resolved = await resolveOrg({ email });
      await requestOtp({ orgId: resolved.orgId, email });
      setOrg(resolved);
      setInfo(`We sent a 6-digit code to ${email}.`);
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      await requestOtp({ orgId: org.orgId, email });
      setInfo(`We sent a new code to ${email}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCodeSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { token } = await verifyOtp({ orgId: org.orgId, email, code });
      login({ token, email, orgId: org.orgId, orgName: org.orgName });
      navigate('/portal/tickets');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-sm">
            Z
          </div>
          <span className="text-lg font-semibold text-gray-900">ZenithDesk</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {step === 'email' ? (
            <>
              <h1 className="mb-1 text-xl font-semibold text-gray-900">Check your ticket status</h1>
              <p className="mb-6 text-sm text-gray-500">
                Enter the email you used to submit a support request.
              </p>
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                )}

                <button type="submit" disabled={submitting} className={`${primaryButtonClass} mt-1`}>
                  {submitting ? 'Sending code…' : 'Send verification code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-xl font-semibold text-gray-900">Enter verification code</h1>
              <p className="mb-6 text-sm text-gray-500">{info}</p>
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="code" className={labelClass}>
                    6-digit code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                    className={`${inputClass} text-center tracking-[0.3em]`}
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                )}

                <button type="submit" disabled={submitting} className={`${primaryButtonClass} mt-1`}>
                  {submitting ? 'Verifying…' : 'Verify and continue'}
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setError('');
                    setInfo('');
                  }}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Use a different email
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Support agent?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Log in to the dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}

export default CustomerLoginPage;
