import { useState, useEffect } from 'react';
import './Recommendations.css';

export default function Recommendations({ token }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('');

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8090/api/user/recommendations?limit=10', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setRecommendations(result.data);
        setSource(result.source);
      } else {
        throw new Error(result.message || 'Failed to get recommendations');
      }
    } catch (err) {
      setError(err.message);
      console.error('Recommendations error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <>
        {'★'.repeat(fullStars)}
        {hasHalfStar && '½★'}
        {'☆'.repeat(emptyStars)}
      </>
    );
  };

  const handleBorrow = (bookId) => {
    // This would integrate with the borrow functionality
    alert(`Borrow functionality for book ${bookId} - integrate with existing borrow logic`);
  };

  if (loading) {
    return (
      <div className="recommendations-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your personalized recommendations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recommendations-container">
        <div className="error-message">
          <h3>Error Loading Recommendations</h3>
          <p>{error}</p>
          <button onClick={fetchRecommendations} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recommendations-container">
      <div className="recommendations-header">
        <h1>Recommended For You</h1>
        <p className="subtitle">
          Based on your reading preferences and history
          {source === 'ml_model' && ' (ML-powered)'}
          {source === 'fallback_popularity' && ' (Popular books)'}
        </p>
      </div>

      {source === 'fallback_popularity' && (
        <div className="info-banner">
          <span className="info-icon">INFO</span>
          <span>Showing popular books while ML service is unavailable</span>
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="no-recommendations">
          <h3>No recommendations available yet</h3>
          <p>Start borrowing and rating books to get personalized recommendations!</p>
        </div>
      ) : (
        <div className="recommendations-grid">
          {recommendations.map((book) => (
            <div key={book.book_id} className="book-card">
              <div className="book-card-content">
                <h3 className="book-title">{book.title}</h3>
                <p className="book-author">by {book.author}</p>
                
                <div className="book-meta">
                  <span className="category-badge">{book.category}</span>
                  {book.isbn && (
                    <span className="isbn-text">ISBN: {book.isbn}</span>
                  )}
                </div>

                <div className="predicted-rating">
                  <span className="stars">{renderStars(book.predicted_rating || 0)}</span>
                  <span className="rating-value">
                    {(book.predicted_rating || 0).toFixed(1)}
                  </span>
                </div>

                {book.popularity !== undefined && (
                  <div className="popularity-info">
                    <span className="popularity-badge">
                      {book.popularity} borrows
                    </span>
                  </div>
                )}
              </div>

              <div className="book-card-actions">
                <button 
                  className="borrow-btn"
                  onClick={() => handleBorrow(book.book_id)}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="recommendations-footer">
        <button onClick={fetchRecommendations} className="refresh-btn">
          Refresh Recommendations
        </button>
      </div>
    </div>
  );
}
