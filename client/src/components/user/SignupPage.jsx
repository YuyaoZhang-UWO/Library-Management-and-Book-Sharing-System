import React, { useState } from 'react';
import './SignupPage.css';

function SignupPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (
      !email ||
      !username ||
      !firstName ||
      !lastName ||
      !dateOfBirth ||
      !password ||
      !confirmPassword
    ) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username,
          first_name: firstName,
          last_name: lastName,
          password,
          date_of_birth: dateOfBirth,
        }),
      });

      if (!res.ok) {
        let message = 'Sign up failed.';
        try {
          const data = await res.json();
          if (data && data.error) {
            message = data.error;
          }
        } catch (_) {}
        setError(message);
      } else {
        window.location.href = '/login';
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-root">
      <div className="signup-card">
        <h2 className="signup-title">Create Your Account</h2>
        <form className="signup-form" onSubmit={handleSubmit}>
          <label className="signup-label">
            Email
            <input
              className="signup-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="signup-label">
            Username
            <input
              className="signup-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="signup-label">
            First Name
            <input
              className="signup-input"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>

          <label className="signup-label">
            Last Name
            <input
              className="signup-input"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>

          <label className="signup-label">
            Date of Birth
            <input
              className="signup-input"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </label>

          <label className="signup-label">
            Password
            <input
              className="signup-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label className="signup-label">
            Confirm Password
            <input
              className="signup-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          {error && <div className="signup-error">{error}</div>}

          <button
            className="signup-primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
        </form>

        <button
          type="button"
          className="signup-link-button"
          onClick={() => (window.location.href = '/')}
        >
          Already have an account? Log In
        </button>
      </div>
    </div>
  );
}

export default SignupPage;
