import { useEffect, useState } from 'react';
import './AdminWaitlist.css';

export default function AdminWaitlist({ token }) {
  const [bookId, setBookId] = useState('');
  const [waitlist, setWaitlist] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchWaitlist(1);
  }, [token]);

  const fetchWaitlist = async (pageNumber = 1) => {
    if (!token) return;

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('page', String(pageNumber));
      params.append('limit', '20');
      if (bookId.trim()) {
        params.append('book_id', bookId.trim());
      }

      const res = await fetch(`/api/admin/waitlist?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to load waitlist');
      }

      const { waitlist: list = [], pagination } = data.data;
      setWaitlist(list);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages || 1);

      if (list.length === 0) {
        setMessage('No waitlist entries found for the current filters.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load waitlist');
      setWaitlist([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchWaitlist(1);
  };

  const handleClearFilters = () => {
    setBookId('');
    fetchWaitlist(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || loading) return;
    fetchWaitlist(newPage);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  return (
    <section className="admin-waitlist-panel">
      <div className="admin-waitlist-header">
        <h2 className="admin-waitlist-title">Waitlist</h2>
        <p className="admin-waitlist-subtitle">
          Monitor users waiting for popular books.
        </p>
      </div>

      <form className="admin-waitlist-filters" onSubmit={handleFilterSubmit}>
        <label className="admin-waitlist-filter-field">
          <span className="admin-waitlist-filter-label">Book ID</span>
          <input
            type="text"
            className="admin-waitlist-filter-input"
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            placeholder="Book ID"
          />
        </label>

        <div className="admin-waitlist-filter-actions">
          <button
            type="submit"
            className="admin-waitlist-button admin-waitlist-button-primary"
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            className="admin-waitlist-button admin-waitlist-button-secondary"
            onClick={handleClearFilters}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </form>

      {(message || error) && (
        <div className="admin-waitlist-messages">
          {message && !error && (
            <div className="admin-waitlist-message admin-waitlist-message-info">
              {message}
            </div>
          )}
          {error && (
            <div className="admin-waitlist-message admin-waitlist-message-error">
              {error}
            </div>
          )}
        </div>
      )}

      {waitlist.length > 0 && (
        <div className="admin-waitlist-table-wrapper">
          <table className="admin-waitlist-table">
            <thead>
              <tr>
                <th>Waitlist ID</th>
                <th>User</th>
                <th>Book</th>
                <th>Requested At</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((row) => (
                <tr key={row.waitlist_id}>
                  <td>{row.waitlist_id}</td>
                  <td>
                    <div className="admin-waitlist-user-cell">
                      <div className="admin-waitlist-user-name">
                        {row.user_name}
                      </div>
                      <div className="admin-waitlist-user-email">
                        {row.user_email}
                      </div>
                      <div className="admin-waitlist-user-id">
                        User ID: {row.user_id}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="admin-waitlist-book-cell">
                      <div className="admin-waitlist-book-title">
                        {row.title}
                      </div>
                      <div className="admin-waitlist-book-meta">
                        {row.author && (
                          <span className="admin-waitlist-tag">
                            {row.author}
                          </span>
                        )}
                        {row.isbn && (
                          <span className="admin-waitlist-tag">
                            ISBN: {row.isbn}
                          </span>
                        )}
                        <span className="admin-waitlist-tag">
                          Book ID: {row.book_id}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{formatDate(row.requested_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-waitlist-pagination">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || loading}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
