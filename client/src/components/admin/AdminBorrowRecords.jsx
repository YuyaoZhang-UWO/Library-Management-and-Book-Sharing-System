import { useEffect, useState } from 'react';
import './AdminBorrowRecords.css';

export default function AdminBorrowRecords({ token }) {
  const [status, setStatus] = useState('');
  const [borrowerId, setBorrowerId] = useState('');
  const [bookId, setBookId] = useState('');
  const [borrows, setBorrows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchBorrows(1);
  }, [token]);

  const fetchBorrows = async (pageNumber = 1) => {
    if (!token) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const params = new URLSearchParams();
      params.append('page', String(pageNumber));
      params.append('limit', '20');

      if (status) params.append('status', status);
      if (borrowerId.trim()) params.append('borrower_id', borrowerId.trim());
      if (bookId.trim()) params.append('book_id', bookId.trim());

      const res = await fetch(`/api/admin/borrows?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to load borrow records');
      }

      const { borrows: list = [], pagination } = data.data;
      setBorrows(list);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages || 1);

      if (list.length === 0) {
        setMessage('No borrow records found for the current filters.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load borrow records');
      setBorrows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    fetchBorrows(1);
  };

  const handleClearFilters = () => {
    setStatus('');
    setBorrowerId('');
    setBookId('');
    fetchBorrows(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || loading) return;
    fetchBorrows(newPage);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  };

  return (
    <section className="admin-borrows-panel">
      <div className="admin-borrows-header">
        <div>
          <h2 className="admin-borrows-title">Borrow Records</h2>
          <p className="admin-borrows-subtitle">
            Review and filter borrow transactions for all users.
          </p>
        </div>
      </div>

      <form className="admin-borrows-filters" onSubmit={handleFilterSubmit}>
        <label className="admin-borrows-filter-field">
          <span className="admin-borrows-filter-label">Status</span>
          <select
            className="admin-borrows-filter-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="borrowed">borrowed</option>
            <option value="returned">returned</option>
            <option value="overdue">overdue</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>

        <label className="admin-borrows-filter-field">
          <span className="admin-borrows-filter-label">Borrower ID</span>
          <input
            type="text"
            className="admin-borrows-filter-input"
            value={borrowerId}
            onChange={(e) => setBorrowerId(e.target.value)}
            placeholder="User ID"
          />
        </label>

        <label className="admin-borrows-filter-field">
          <span className="admin-borrows-filter-label">Book ID</span>
          <input
            type="text"
            className="admin-borrows-filter-input"
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            placeholder="Book ID"
          />
        </label>

        <div className="admin-borrows-filter-actions">
          <button
            type="submit"
            className="admin-borrows-button admin-borrows-button-primary"
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            className="admin-borrows-button admin-borrows-button-secondary"
            onClick={handleClearFilters}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </form>

      {(message || error) && (
        <div className="admin-borrows-messages">
          {message && !error && (
            <div className="admin-borrows-message admin-borrows-message-info">
              {message}
            </div>
          )}
          {error && (
            <div className="admin-borrows-message admin-borrows-message-error">
              {error}
            </div>
          )}
        </div>
      )}

      {borrows.length > 0 && (
        <div className="admin-borrows-table-wrapper">
          <table className="admin-borrows-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Book</th>
                <th>Borrower</th>
                <th>Owner</th>
                <th>Borrowed</th>
                <th>Due</th>
                <th>Returned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {borrows.map((row) => (
                <tr key={row.transaction_id}>
                  <td>{row.transaction_id}</td>
                  <td>
                    <div className="admin-borrows-book-cell">
                      <div className="admin-borrows-book-title">
                        {row.title}
                      </div>
                      <div className="admin-borrows-book-meta">
                        {row.author && (
                          <span className="admin-borrows-tag">
                            {row.author}
                          </span>
                        )}
                        {row.isbn && (
                          <span className="admin-borrows-tag">
                            ISBN: {row.isbn}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="admin-borrows-user-cell">
                      <div className="admin-borrows-user-name">
                        {row.borrower_name}
                      </div>
                      <div className="admin-borrows-user-email">
                        {row.borrower_email}
                      </div>
                    </div>
                  </td>
                  <td>{row.owner_name}</td>
                  <td>{formatDate(row.borrow_date)}</td>
                  <td>{formatDate(row.due_date)}</td>
                  <td>{formatDate(row.return_date)}</td>
                  <td className="admin-borrows-status-cell">
                    <span
                      className={`admin-borrows-status admin-borrows-status-${row.status}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-borrows-pagination">
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
