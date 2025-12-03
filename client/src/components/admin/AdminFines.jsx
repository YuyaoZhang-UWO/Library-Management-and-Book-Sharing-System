import { useEffect, useState } from 'react';
import './AdminFines.css';

export default function AdminFines({ token }) {
  const [fines, setFines] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filterPaid, setFilterPaid] = useState('all'); // all | paid | unpaid
  const [filterUserId, setFilterUserId] = useState('');

  const [summaryTotal, setSummaryTotal] = useState(0);
  const [summaryAmount, setSummaryAmount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [savingFineId, setSavingFineId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // For editing amounts
  const [editAmounts, setEditAmounts] = useState({});

  useEffect(() => {
    if (!token) return;
    fetchFines(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchFines = async (pageNumber = 1) => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('page', String(pageNumber));
      params.append('limit', '20');

      if (filterUserId.trim()) {
        params.append('user_id', filterUserId.trim());
      }

      if (filterPaid === 'paid') {
        params.append('paid', 'true');
      } else if (filterPaid === 'unpaid') {
        params.append('paid', 'false');
      }

      const res = await fetch(`/api/admin/fines?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to load fines');
      }

      const { fines: list = [], summary, pagination } = data.data;

      setFines(list);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages || 1);

      setSummaryTotal(summary.total || 0);
      setSummaryAmount(summary.total_amount || 0);

      // sync editAmounts with latest amounts
      const nextEdit = {};
      list.forEach((f) => {
        nextEdit[f.fine_id] = String(f.amount ?? '');
      });
      setEditAmounts(nextEdit);

      if (list.length === 0) {
        setMessage('No fines found for the current filters.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load fines');
      setFines([]);
      setSummaryTotal(0);
      setSummaryAmount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchFines(1);
  };

  const handleClearFilters = () => {
    setFilterPaid('all');
    setFilterUserId('');
    fetchFines(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || loading) return;
    fetchFines(newPage);
  };

  const handleAmountChange = (fineId, value) => {
    setEditAmounts((prev) => ({
      ...prev,
      [fineId]: value,
    }));
  };

  const updateFine = async (fineId, payload) => {
    if (!token) return;
    setSavingFineId(fineId);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/admin/fines/${fineId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to update fine');
      }

      setMessage('Fine updated successfully.');
      // refresh current page
      fetchFines(page);
    } catch (err) {
      setError(err.message || 'Failed to update fine');
    } finally {
      setSavingFineId(null);
    }
  };

  const handleTogglePaid = (fine) => {
    const newPaid = !fine.paid;
    updateFine(fine.fine_id, { paid: newPaid });
  };

  const handleSaveAmount = (fine) => {
    const raw = editAmounts[fine.fine_id];
    const value = parseFloat(raw);
    if (Number.isNaN(value) || value < 0) {
      setError('Please enter a valid non-negative amount.');
      return;
    }
    updateFine(fine.fine_id, { amount: value });
  };

  const formatMoney = (amount) => {
    const num = Number(amount || 0);
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  return (
    <section className="admin-fines-panel">
      <div className="admin-fines-header">
        <h2 className="admin-fines-title">Fines</h2>
        <p className="admin-fines-subtitle">
          View and update fine records, including payment status.
        </p>
      </div>

      {/* Summary */}
      <div className="admin-fines-summary">
        <div className="admin-fines-summary-item">
          <span className="admin-fines-summary-label">Total fines</span>
          <span className="admin-fines-summary-value">{summaryTotal}</span>
        </div>
        <div className="admin-fines-summary-item">
          <span className="admin-fines-summary-label">Total amount</span>
          <span className="admin-fines-summary-value">
            {formatMoney(summaryAmount)}
          </span>
        </div>
      </div>

      {/* Filters */}
      <form className="admin-fines-filters" onSubmit={handleFilterSubmit}>
        <label className="admin-fines-filter-field">
          <span className="admin-fines-filter-label">Payment status</span>
          <select
            className="admin-fines-filter-input"
            value={filterPaid}
            onChange={(e) => setFilterPaid(e.target.value)}
          >
            <option value="all">All</option>
            <option value="unpaid">Unpaid only</option>
            <option value="paid">Paid only</option>
          </select>
        </label>

        <label className="admin-fines-filter-field">
          <span className="admin-fines-filter-label">User ID</span>
          <input
            type="text"
            className="admin-fines-filter-input"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            placeholder="Filter by user ID"
          />
        </label>

        <div className="admin-fines-filter-actions">
          <button
            type="submit"
            className="admin-fines-button admin-fines-button-primary"
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            className="admin-fines-button admin-fines-button-secondary"
            onClick={handleClearFilters}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </form>

      {/* Messages */}
      {(message || error) && (
        <div className="admin-fines-messages">
          {message && !error && (
            <div className="admin-fines-message admin-fines-message-info">
              {message}
            </div>
          )}
          {error && (
            <div className="admin-fines-message admin-fines-message-error">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {fines.length > 0 && (
        <div className="admin-fines-table-wrapper">
          <table className="admin-fines-table">
            <thead>
              <tr>
                <th>Fine ID</th>
                <th>User</th>
                <th>Book</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Paid At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fines.map((fine) => (
                <tr key={fine.fine_id}>
                  <td>{fine.fine_id}</td>
                  <td>
                    <div className="admin-fines-user-cell">
                      <div className="admin-fines-user-name">
                        {fine.user_name}
                      </div>
                      <div className="admin-fines-user-email">
                        {fine.user_email}
                      </div>
                      <div className="admin-fines-user-id">
                        User ID: {fine.user_id}
                      </div>
                    </div>
                  </td>
                  <td>
                    {fine.book_id ? (
                      <div className="admin-fines-book-cell">
                        <div className="admin-fines-book-title">
                          {fine.title || 'Untitled'}
                        </div>
                        <div className="admin-fines-book-meta">
                          {fine.author && (
                            <span className="admin-fines-tag">
                              {fine.author}
                            </span>
                          )}
                          <span className="admin-fines-tag">
                            Book ID: {fine.book_id}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="admin-fines-muted">No book linked</span>
                    )}
                  </td>
                  <td>
                    <div className="admin-fines-amount-cell">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="admin-fines-amount-input"
                        value={editAmounts[fine.fine_id] ?? ''}
                        onChange={(e) =>
                          handleAmountChange(fine.fine_id, e.target.value)
                        }
                      />
                      <span className="admin-fines-amount-display">
                        {formatMoney(fine.amount)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        fine.paid
                          ? 'admin-fines-status-badge admin-fines-status-paid'
                          : 'admin-fines-status-badge admin-fines-status-unpaid'
                      }
                    >
                      {fine.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td>{formatDate(fine.issued_at)}</td>
                  <td>{formatDate(fine.paid_at)}</td>
                  <td>
                    <div className="admin-fines-actions">
                      <button
                        type="button"
                        className="admin-fines-action-button"
                        onClick={() => handleTogglePaid(fine)}
                        disabled={savingFineId === fine.fine_id}
                      >
                        {fine.paid ? 'Mark Unpaid' : 'Mark Paid'}
                      </button>
                      <button
                        type="button"
                        className="admin-fines-action-button admin-fines-action-secondary"
                        onClick={() => handleSaveAmount(fine)}
                        disabled={savingFineId === fine.fine_id}
                      >
                        Save Amount
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="admin-fines-pagination">
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
