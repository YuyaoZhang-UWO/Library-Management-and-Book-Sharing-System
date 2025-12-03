import { useEffect, useState } from 'react';
import './Notifications.css';

export default function Notifications({ token, user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  async function fetchNotifications() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/user/notifications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to load notifications');
      }
      const data = await res.json();
      setNotifications(data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString();
  }

  return (
    <div className="notif-section">
      <div className="notif-header">
        <div>
          <h1 className="notif-title">Notifications</h1>
          <p className="notif-subtitle">
            Check recent updates about your borrowed and waitlisted books.
          </p>
        </div>
        <div className="notif-counter">
          <span className="notif-counter-number">{notifications.length}</span>
          <span className="notif-counter-label">
            {notifications.length === 1 ? 'message' : 'messages'}
          </span>
        </div>
      </div>

      {loading && <div className="notif-status">Loading...</div>}
      {error && !loading && (
        <div className="notif-status notif-status-error">{error}</div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="notif-status">You have no notifications.</div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="notif-list">
          {notifications.map((n) => (
            <li key={n.notification_id} className="notif-item">
              <div className="notif-item-main">
                <div className="notif-dot" />
                <div className="notif-message">{n.message}</div>
              </div>
              <div className="notif-time">{formatDate(n.created_at)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
