const Joi = require('joi');

// public subset schema
const numberSchema = Joi.number().integer().required();
const floatNumberSchema = Joi.number().required();
const positiveNumberSchema = Joi.number().integer().min(1).required();
const optionalPositiveNumberSchema = Joi.number().integer().min(1).optional();
const nameSchema = Joi.string()
  .required()
  .custom((s) => (s.length > 200 ? s.slice(0, 200) : s));
const titleSchema = Joi.string()
  .required()
  .custom((s) => (s.length > 200 ? s.slice(0, 200) : s));
const authorSchema = Joi.string()
  .required()
  .custom((s) => (s.length > 200 ? s.slice(0, 200) : s));
const isbnSchema = Joi.string()
  .pattern(/^[0-9]{10,13}$/)
  .optional()
  .allow(null, '');
const descriptionSchema = Joi.string()
  .max(2000)
  .optional()
  .allow(null, '');
const commentSchema = Joi.string()
  .max(1000)
  .optional()
  .allow(null, '');
const reviewTextSchema = Joi.string()
  .max(2000)
  .optional()
  .allow(null, '');
const passwordSchema = Joi.string().min(4).max(16).required();
const emailSchema = Joi.string().email({ tlds: false }).required();
const dateSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .optional();
const ratingSchema = Joi.number().integer().min(1).max(5).required();

// Search schema
const searchSchema = Joi.string()
  .trim()
  .max(100)
  .allow('')
  .optional();

// Library management schema
const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
});

const addBookSchema = Joi.object({
  title: titleSchema,
  author: authorSchema.optional(),
  isbn: isbnSchema,
  category: Joi.string().max(50).optional().allow(null, ''),
  conditions: Joi.string().max(50).optional().allow(null, ''),
});

const updateBookSchema = Joi.object({
  title: titleSchema.optional(),
  author: authorSchema.optional(),
  isbn: isbnSchema,
  category: Joi.string().max(50).optional().allow(null, ''),
  conditions: Joi.string().max(50).optional().allow(null, ''),
  availability_status: Joi.string().valid('available', 'lent_out', 'reserved').optional(),
});

const borrowBookSchema = Joi.object({
  book_id: positiveNumberSchema,
});

const returnBookSchema = Joi.object({
  transaction_id: positiveNumberSchema,
});

const renewBookSchema = Joi.object({
  transaction_id: positiveNumberSchema,
});

const waitlistBookSchema = Joi.object({
  book_id: positiveNumberSchema,
});

const cancelWaitlistSchema = Joi.object({
  waitlist_id: positiveNumberSchema,
});

const addReviewSchema = Joi.object({
  book_id: positiveNumberSchema,
  rating: ratingSchema,
  comment: commentSchema,
});

const updateReviewSchema = Joi.object({
  review_id: positiveNumberSchema,
  rating: ratingSchema.optional(),
  comment: commentSchema,
});

const payFineSchema = Joi.object({
  fine_id: positiveNumberSchema,
  amount: floatNumberSchema.min(0),
});

const bookSearchSchema = Joi.object({
  query: searchSchema,
  category: Joi.string().max(100).optional(),
  author: Joi.string().max(200).optional(),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

//joi validation
function validateInput(schema, data, res) {
  const { value, error } = schema.validate(data, { abortEarly: false });
  if (error) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: error.details.map((d) => d.message),
    });

    return false;
  }
  return value;
}

module.exports = {
  validateInput,
  // Basic schema
  numberSchema,
  positiveNumberSchema,
  optionalPositiveNumberSchema,
  floatNumberSchema,
  emailSchema,
  passwordSchema,
  commentSchema,
  // Library management schema
  loginSchema,
  addBookSchema,
  updateBookSchema,
  borrowBookSchema,
  returnBookSchema,
  renewBookSchema,
  waitlistBookSchema,
  cancelWaitlistSchema,
  addReviewSchema,
  updateReviewSchema,
  payFineSchema,
  bookSearchSchema,
};
