import { useEffect, useState } from 'react';
import './MyFavourites.css';

export default function MyFavourites({ token }) {
  const [favorites, setFavorites] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [borrowLoadingId, setBorrowLoadingId] = useState(null);
  const [removeLoadingId, setRemoveLoadingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchFavorites = async (pageNumber = 1) => {
    if (!token) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const params = new URLSearchParams();
      params.append('page', String(pageNumber));
      params.append('limit', '10');

      const res = await fetch(`/api/user/favorites?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to load favorites');
      }

      const { favorites: favList = [], pagination } = data.data;
      setFavorites(favList);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load favorites');
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchFavorites(1);
  }, [token]);

  const handleBorrow = async (bookId) => {
    if (!token) return;

    setBorrowLoadingId(bookId);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/user/borrow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ book_id: bookId }),
      });

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to borrow book');
      }

      setMessage('Book borrowed successfully.');
    } catch (err) {
      setError(err.message || 'Failed to borrow book');
    } finally {
      setBorrowLoadingId(null);
    }
  };

  const handleRemoveFavorite = async (favorite) => {
    if (!token) return;

    const favoriteId = favorite.favorite_id;

    setRemoveLoadingId(favoriteId);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/user/favorites', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ favorite_id: favoriteId }),
      });

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to remove favorite');
      }

      setFavorites((prev) =>
        prev.filter((item) => item.favorite_id !== favoriteId),
      );
      setMessage('Removed from favorites.');
    } catch (err) {
      setError(err.message || 'Failed to remove favorite');
    } finally {
      setRemoveLoadingId(null);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchFavorites(newPage);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  return (
    <section className="fav-panel">
      <div className="fav-header">
        <div>
          <h2 className="fav-title">My Favourites</h2>
          <p className="fav-subtitle">
            Browse your saved books. You can borrow or remove them from your
            favourites.
          </p>
        </div>
      </div>

      {(message || error) && (
        <div className="fav-messages">
          {message && (
            <div className="fav-message fav-message-success">{message}</div>
          )}
          {error && (
            <div className="fav-message fav-message-error">{error}</div>
          )}
        </div>
      )}

      {favorites.length === 0 && !loading ? (
        <div className="fav-empty">You have no favorite books yet.</div>
      ) : (
        <div className="fav-table-wrapper">
          <table className="fav-table">
            <thead>
              <tr>
                <th>Title &amp; details</th>
                <th>Author</th>
                <th>Category</th>
                <th>Added to favourites</th>
                <th className="fav-actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {favorites.map((fav) => (
                <tr key={fav.favorite_id}>
                  <td>
                    <div className="fav-title-cell">
                      <div className="fav-book-title">{fav.title}</div>
                      <div className="fav-book-meta">
                        {fav.isbn && (
                          <span className="fav-tag">ISBN: {fav.isbn}</span>
                        )}
                        {fav.conditions && (
                          <span className="fav-tag">
                            Condition: {fav.conditions}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{fav.author || '-'}</td>
                  <td>{fav.category || '-'}</td>
                  <td>{formatDate(fav.created_at)}</td>
                  <td>
                    <div className="fav-action-buttons">
                      <button
                        type="button"
                        className="fav-remove-button"
                        onClick={() => handleRemoveFavorite(fav)}
                        disabled={removeLoadingId === fav.favorite_id}
                      >
                        {removeLoadingId === fav.favorite_id
                          ? 'Removing…'
                          : 'Remove'}
                      </button>
                      <button
                        type="button"
                        className="fav-borrow-button"
                        onClick={() => handleBorrow(fav.book_id)}
                        disabled={borrowLoadingId === fav.book_id}
                      >
                        {borrowLoadingId === fav.book_id
                          ? 'Borrowing…'
                          : 'Borrow'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="fav-pagination">
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
