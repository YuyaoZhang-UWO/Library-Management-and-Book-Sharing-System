import { useState } from 'react';
import './HomePage.css';

function HomePage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setMessage('Please enter email and password.');
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.message || 'Login unsuccessful.');
        return;
      }

      setMessage(data.message || 'Login successful.');

      onLoginSuccess(data.token, {
        email: data.email,
        role: data.role,
        user_id: data.user_id,
      });
    } catch (err) {
      console.error('Login error:', err);
      setMessage('Error contacting server.');
    }
  };

  const handleSignupClick = () => {
    window.location.href = '/signup';
  };

  const handleGuestClick = () => {
    window.location.href = '/guest';
  };

  return (
    <div className="home-layout">
      <div className="home-sidebar">
        <form onSubmit={handleLoginSubmit} className="home-form">
          <div className="home-form-row">
            <label className="home-label">
              <span className="home-label-text">Email:</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="home-input"
              />
            </label>
          </div>

          <div className="home-form-row">
            <label className="home-label">
              <span className="home-label-text">Password:</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="home-input"
              />
            </label>
          </div>

          <div className="home-actions">
            <button type="submit" className="home-button home-button-full">
              Log In
            </button>
            <button
              type="button"
              className="home-button home-button-full"
              onClick={handleSignupClick}
            >
              Sign Up
            </button>
          </div>

          <button
            type="button"
            className="home-button home-button-secondary home-guest-button"
            onClick={handleGuestClick}
          >
            Continue as Guest
          </button>

          <p className="home-message">{message}</p>
        </form>
      </div>

      <div className="home-content home-hero-bg">
        <section className="home-hero-card">
          <h1 className="home-hero-title">
            Share Your Books.
            <br />
            Discover New Stories.
          </h1>
        </section>
      </div>
    </div>
  );
}

export default HomePage;
