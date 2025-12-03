import { useEffect, useState } from 'react';
import './MyBorrowedBooks.css';

export default function MyBorrowedBooks({ token, user }) {
  const [borrows, setBorrows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchBorrows = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const response = await fetch('/api/user/borrows', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Failed to load borrow records');
      }

      setBorrows(result.data || []);
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load borrow records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBorrows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleReturn = async (transactionId) => {
    if (!token) return;

    setActionId(transactionId);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const response = await fetch('/api/user/return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transaction_id: transactionId }),
      });

      const result = await response.json();

      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Failed to return book');
      }

      setInfoMessage('Book returned successfully.');
      await fetchBorrows();
    } catch (error) {
      setErrorMessage(error.message || 'Failed to return book');
    } finally {
      setActionId(null);
    }
  };

  const handleRenew = async (transactionId) => {
    if (!token) return;

    setActionId(transactionId);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const response = await fetch('/api/user/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transaction_id: transactionId }),
      });

      const result = await response.json();

      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Failed to renew book');
      }

      setInfoMessage('Book renewed successfully.');
      await fetchBorrows();
    } catch (error) {
      setErrorMessage(error.message || 'Failed to renew book');
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  const isOverdue = (borrow) => {
    if (borrow.status !== 'borrowed' || !borrow.due_date) return false;
    const now = new Date();
    const dueDate = new Date(borrow.due_date);
    return dueDate < now;
  };

  return (
    <section className="borrow-panel">
      <div className="borrow-header">
        <h2 className="borrow-title">My Borrowed Books</h2>
      </div>

      {(infoMessage || errorMessage) && (
        <div className="borrow-messages">
          {infoMessage && (
            <div className="borrow-message borrow-message-success">
              {infoMessage}
            </div>
          )}
          {errorMessage && (
            <div className="borrow-message borrow-message-error">
              {errorMessage}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="borrow-loading">Loading your borrow records...</div>
      ) : borrows.length === 0 ? (
        <div className="borrow-empty">
          You do not have any borrow records yet.
        </div>
      ) : (
        <div className="borrow-table-wrapper">
          <table className="borrow-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Borrowed On</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="borrow-actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {borrows.map((borrow) => (
                <tr key={borrow.transaction_id}>
                  <td>
                    <div className="borrow-book-title">{borrow.title}</div>
                    <div className="borrow-book-meta">
                      {borrow.isbn && <span>ISBN: {borrow.isbn}</span>}
                      {borrow.category && (
                        <span className="borrow-book-category">
                          {borrow.category}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{borrow.author || '-'}</td>
                  <td>{formatDate(borrow.borrow_date)}</td>
                  <td
                    className={isOverdue(borrow) ? 'borrow-date-overdue' : ''}
                  >
                    {formatDate(borrow.due_date)}
                  </td>
                  <td>
                    <span
                      className={
                        isOverdue(borrow)
                          ? 'borrow-status-badge borrow-status-overdue'
                          : borrow.status === 'borrowed'
                          ? 'borrow-status-badge borrow-status-active'
                          : 'borrow-status-badge borrow-status-returned'
                      }
                    >
                      {isOverdue(borrow)
                        ? 'Overdue'
                        : borrow.status === 'borrowed'
                        ? 'Borrowed'
                        : 'Returned'}
                    </span>
                  </td>
                  <td>
                    <div className="borrow-actions">
                      {borrow.status === 'borrowed' && (
                        <>
                          <button
                            type="button"
                            className="borrow-button"
                            onClick={() => handleReturn(borrow.transaction_id)}
                            disabled={actionId === borrow.transaction_id}
                          >
                            Return
                          </button>
                          <button
                            type="button"
                            className="borrow-button borrow-button-secondary"
                            onClick={() => handleRenew(borrow.transaction_id)}
                            disabled={actionId === borrow.transaction_id}
                          >
                            Renew
                          </button>
                        </>
                      )}
                      {borrow.status === 'returned' && (
                        <span className="borrow-no-actions">No actions</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
