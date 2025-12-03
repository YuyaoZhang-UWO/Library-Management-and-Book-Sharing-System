import { useEffect, useState } from 'react';
import './BorrowBooks.css';

export default function BorrowBooks({ token, user }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [borrowLoadingId, setBorrowLoadingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/open/categories', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
          throw new Error(data.message || 'Failed to load categories');
        }
        setCategories(data.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchCategories();
  }, [token]);

  const fetchBooks = async (pageNumber = 1) => {
    if (!token) {
      setError('Missing authentication token');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append('query', query.trim());
      if (category) params.append('category', category);
      if (author.trim()) params.append('author', author.trim());
      params.append('page', String(pageNumber));
      params.append('limit', '10');

      const res = await fetch(`/api/open/books/search?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to search books');
      }

      const { books: bookList = [], pagination } = data.data;
      setBooks(bookList);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to search books');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchBooks(1);
  };

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
      setBooks((prev) => prev.filter((b) => b.book_id !== bookId));
    } catch (err) {
      setError(err.message || 'Failed to borrow book');
    } finally {
      setBorrowLoadingId(null);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchBooks(newPage);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  return (
    <section className="borrow-books-panel">
      <div className="borrow-books-header">
        <div>
          <h2 className="borrow-books-title">Borrow Books</h2>
          <p className="borrow-books-subtitle">
            Search available books and borrow them from other users.
          </p>
        </div>
        {user && (
          <p className="borrow-books-user">
            Logged in as <span>{user.first_name}</span>
          </p>
        )}
      </div>

      <form className="borrow-books-form" onSubmit={handleSubmit}>
        <div className="borrow-books-row">
          <label className="borrow-books-label">
            <span className="borrow-books-label-text">Keyword</span>
            <input
              type="text"
              className="borrow-books-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, author, or ISBN"
            />
          </label>
        </div>

        <div className="borrow-books-row borrow-books-row-inline">
          <label className="borrow-books-label">
            <span className="borrow-books-label-text">Category</span>
            <select
              className="borrow-books-input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.category} value={item.category}>
                  {item.category} ({item.book_count})
                </option>
              ))}
            </select>
          </label>

          <label className="borrow-books-label">
            <span className="borrow-books-label-text">Author</span>
            <input
              type="text"
              className="borrow-books-input"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Author name"
            />
          </label>

          <div className="borrow-books-actions">
            <button
              type="submit"
              className="borrow-books-button"
              disabled={loading}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {(message || error) && (
        <div className="borrow-books-messages">
          {message && (
            <div className="borrow-books-message borrow-books-message-success">
              {message}
            </div>
          )}
          {error && (
            <div className="borrow-books-message borrow-books-message-error">
              {error}
            </div>
          )}
        </div>
      )}

      {books.length === 0 && !loading ? (
        <div className="borrow-books-empty">No books found.</div>
      ) : (
        <div className="borrow-books-table-wrapper">
          <table className="borrow-books-table">
            <thead>
              <tr>
                <th>Title &amp; details</th>
                <th>Author</th>
                <th>Category</th>
                <th>Owner</th>
                <th>Added</th>
                <th className="borrow-books-actions-column">Action</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.book_id}>
                  <td>
                    <div className="borrow-books-title-cell">
                      <div className="borrow-books-book-title">
                        {book.title}
                      </div>
                      <div className="borrow-books-book-meta">
                        {book.isbn && (
                          <span className="borrow-books-tag">
                            ISBN: {book.isbn}
                          </span>
                        )}
                        {book.conditions && (
                          <span className="borrow-books-tag">
                            Condition: {book.conditions}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{book.author || '-'}</td>
                  <td>{book.category || '-'}</td>
                  <td>{book.owner_name || '-'}</td>
                  <td>{formatDate(book.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="borrow-books-button borrow-books-button-small"
                      onClick={() => handleBorrow(book.book_id)}
                      disabled={
                        borrowLoadingId === book.book_id ||
                        book.availability_status !== 'available'
                      }
                    >
                      {borrowLoadingId === book.book_id
                        ? 'Borrowing…'
                        : 'Borrow'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="borrow-books-pagination">
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
