# ML Recommendations Module

Machine Learning-powered book recommendation system using Matrix Factorization (SVD).

## Overview

This module implements a personalized book recommendation system using collaborative filtering with Singular Value Decomposition (SVD). It generates recommendations based on user reading history and ratings.

## Files

- `extract_data.py` - Exports data from MySQL to CSV for training
- `train_model.py` - Trains the SVD model using scikit-surprise
- `ml_service.py` - Flask microservice for serving predictions
- `requirements.txt` - Python dependencies
- `AI_USAGE.md` - Documentation of AI assistance used
- `data/` - Directory for CSV files and trained model (created automatically)

## Setup

### 1. Install Dependencies

```bash
cd server/ml
pip install -r requirements.txt
```

### 2. Load Existing Synthetic Data

The project already includes synthetic data in `Insert data-2.sql`:
- 500 users
- 10,000 books
- 15,000 reviews/ratings

Make sure this data is loaded into MySQL before proceeding.

### 3. Extract Training Data

```bash
python3 extract_data.py
```

Exports to `data/`:
- `users.csv` - User features
- `books.csv` - Book features
- `ratings.csv` - User-book ratings (main training data)

### 4. Train the Model

```bash
python3 train_model.py
```

Trains SVD model and saves to `data/svd_model.pkl`

Expected output:
- RMSE: 0.8-1.2 (good range)
- Training time: 30-90 seconds

### 5. Start ML Service

```bash
python3 ml_service.py
```

Runs Flask server on `http://localhost:5001`

## API Endpoints

### Health Check
```bash
GET http://localhost:5001/health
```

### Get Recommendations
```bash
POST http://localhost:5001/predict
Content-Type: application/json

{
  "user_id": 1,
  "top_n": 10,
  "exclude_borrowed": true
}
```

Response:
```json
{
  "status": "success",
  "user_id": 1,
  "total_predictions": 450,
  "recommendations": [
    {
      "book_id": 123,
      "title": "Book Title",
      "author": "Author Name",
      "category": "Fiction",
      "predicted_rating": 4.75
    }
  ]
}
```

## Integration

The Node.js backend (`server/routes/user/index.js`) calls this ML service at:
```
GET /api/user/recommendations?limit=10
```

If the ML service is unavailable, it falls back to popularity-based recommendations.

## Model Details

- **Algorithm:** SVD (Singular Value Decomposition)
- **Library:** scikit-surprise 1.1.3
- **Hyperparameters:**
  - `n_factors`: 50 (latent dimensions)
  - `n_epochs`: 20 (training iterations)
  - `lr_all`: 0.005 (learning rate)
  - `reg_all`: 0.02 (L2 regularization)

## User Personas

The existing synthetic data in `Insert data-2.sql` includes diverse user reading patterns across multiple categories.

## Performance

- **Training Time:** ~30-90 seconds
- **Inference Time:** <100ms per user
- **RMSE:** 0.8-1.2 (on test set)
- **Data Size:** 15,000 ratings

## Troubleshooting

### Model file not found
Run `train_model.py` first to generate `data/svd_model.pkl`

### Database connection error
Check MySQL credentials in DB_CONFIG match `dbPool.js`

### RMSE too high (>1.5)
- Regenerate synthetic data with more signal
- Tune hyperparameters in `train_model.py`

### ML service not responding
- Check if Flask server is running on port 5001
- Backend will automatically fallback to popularity-based recommendations

## License

Part of ECE9014 course project - Fall 2025
