import { useEffect, useState } from 'react';
import './MyWaitlist.css';

export default function MyWaitlist({ token, user }) {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    fetchWaitlist();
  }, [token]);

  async function fetchWaitlist() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/user/waitlist', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to load waitlist');
      }
      const data = await res.json();
      setWaitlist(data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(waitlistId) {
    try {
      setCancellingId(waitlistId);
      const res = await fetch('/api/user/waitlist/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ waitlist_id: waitlistId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to cancel waitlist');
      }
      await fetchWaitlist();
    } catch (err) {
      alert(err.message || 'Failed to cancel waitlist');
    } finally {
      setCancellingId(null);
    }
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  }

  return (
    <div className="user-section">
      <div className="user-section-header">
        <div>
          <h1 className="user-section-title">My Waitlist</h1>
          <p className="user-section-subtitle">
            View and manage the books you are waiting for.
          </p>
        </div>
        <div className="user-section-meta">
          <span className="user-pill">
            {waitlist.length} {waitlist.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {loading && <div className="user-section-status">Loading...</div>}
      {error && !loading && (
        <div className="user-section-status user-section-status-error">
          {error}
        </div>
      )}

      {!loading && !error && waitlist.length === 0 && (
        <div className="user-section-status">
          You are not on the waitlist for any books.
        </div>
      )}

      {!loading && !error && waitlist.length > 0 && (
        <div className="user-table-wrapper">
          <table className="user-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Category</th>
                <th>ISBN</th>
                <th>Requested At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((item) => (
                <tr key={item.waitlist_id}>
                  <td>{item.title}</td>
                  <td>{item.author || '-'}</td>
                  <td>{item.category || '-'}</td>
                  <td>{item.isbn || '-'}</td>
                  <td>{formatDate(item.requested_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="user-btn-secondary"
                      disabled={cancellingId === item.waitlist_id}
                      onClick={() => handleCancel(item.waitlist_id)}
                    >
                      {cancellingId === item.waitlist_id
                        ? 'Cancelling...'
                        : 'Cancel'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
