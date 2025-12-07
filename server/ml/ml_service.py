#!/usr/bin/env python3
"""
Flask Microservice for ML Predictions
Provides REST API for book recommendations using trained SVD model
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import mysql.connector
import os
import sys

app = Flask(__name__)
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'library_manage',
    'password': '123456',
    'database': 'library_sharing_system'
}

# Load trained model on startup
model = None
MODEL_PATH = 'data/svd_model.pkl'

def load_model():
    """Load the trained SVD model"""
    global model
    
    if not os.path.exists(MODEL_PATH):
        print(f"ERROR: Model file not found at {MODEL_PATH}")
        print("Please run train_model.py first to train the model.")
        sys.exit(1)
    
    try:
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        print(f"SUCCESS: Model loaded successfully from {MODEL_PATH}")
    except Exception as e:
        print(f"ERROR: Error loading model: {e}")
        sys.exit(1)

# Load model when app starts
load_model()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'service': 'ML Recommendations Service'
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Generate book recommendations for a user
    
    Request body:
    {
        "user_id": int,
        "top_n": int (default: 10),
        "exclude_borrowed": bool (default: true)
    }
    
    Response:
    {
        "status": "success",
        "user_id": int,
        "recommendations": [
            {
                "book_id": int,
                "title": str,
                "author": str,
                "category": str,
                "predicted_rating": float
            }
        ]
    }
    """
    try:
        # Parse request
        data = request.json
        
        if not data or 'user_id' not in data:
            return jsonify({
                'status': 'error',
                'message': 'user_id is required'
            }), 400
        
        user_id = data.get('user_id')
        top_n = data.get('top_n', 10)
        exclude_borrowed = data.get('exclude_borrowed', True)
        
        # Validate inputs
        try:
            user_id = int(user_id)
            top_n = int(top_n)
        except ValueError:
            return jsonify({
                'status': 'error',
                'message': 'user_id and top_n must be integers'
            }), 400
        
        if top_n < 1 or top_n > 100:
            return jsonify({
                'status': 'error',
                'message': 'top_n must be between 1 and 100'
            }), 400
        
        # Connect to database
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # Verify user exists
        cursor.execute("SELECT user_id FROM users WHERE user_id = %s", (user_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({
                'status': 'error',
                'message': f'User {user_id} not found'
            }), 404
        
        # Get all books
        cursor.execute("""
            SELECT book_id, title, author, category 
            FROM books
            ORDER BY book_id
        """)
        books = cursor.fetchall()
        
        # Get books already rated or borrowed by user (to exclude)
        excluded_books = set()
        if exclude_borrowed:
            cursor.execute("""
                SELECT DISTINCT book_id FROM reviews WHERE reviewer_id = %s
                UNION
                SELECT DISTINCT i.book_id 
                FROM borrow_transactions bt
                JOIN inventory i ON bt.inventory_id = i.inventory_id
                WHERE bt.borrower_id = %s
            """, (user_id, user_id))
            excluded_books = {row['book_id'] for row in cursor.fetchall()}
        
        cursor.close()
        conn.close()
        
        # Generate predictions for all unrated/unborrowed books
        predictions = []
        
        for book in books:
            book_id = book['book_id']
            
            # Skip if user already interacted with this book
            if book_id in excluded_books:
                continue
            
            # Predict rating
            pred = model.predict(user_id, book_id)
            
            predictions.append({
                'book_id': book_id,
                'title': book['title'],
                'author': book['author'],
                'category': book['category'],
                'predicted_rating': round(pred.est, 2)
            })
        
        # Sort by predicted rating (descending) and return top N
        predictions.sort(key=lambda x: x['predicted_rating'], reverse=True)
        top_recommendations = predictions[:top_n]
        
        return jsonify({
            'status': 'success',
            'user_id': user_id,
            'total_predictions': len(predictions),
            'recommendations': top_recommendations
        })
        
    except mysql.connector.Error as db_err:
        return jsonify({
            'status': 'error',
            'message': f'Database error: {str(db_err)}'
        }), 500
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Internal error: {str(e)}'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500

if __name__ == '__main__':
    print("=" * 60)
    print("ML Recommendations Microservice")
    print("=" * 60)
    print(f"Model: {MODEL_PATH}")
    print(f"Database: {DB_CONFIG['database']}")
    print("=" * 60)
    print("\nStarting Flask server on http://localhost:5001")
    print("\nAvailable endpoints:")
    print("  GET  /health - Health check")
    print("  POST /predict - Generate recommendations")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=True)
