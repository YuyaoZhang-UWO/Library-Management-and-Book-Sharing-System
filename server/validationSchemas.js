const Joi = require('joi');

// publich  subschema
const numberSchema = Joi.number().integer().required();
const floatNumberSchema = Joi.number().required();
const termCodeSchema = Joi.number().integer().min(1).max(9999).required();
const sectionSchema = Joi.number().integer().min(1).max(99).optional();
const courseNameSchema = Joi.string()
  .required()
  .custom((s) => (s.length > 100 ? s.slice(0, 100) : s));
const memberIDSchema = Joi.string().length(8).required();
const nameSchema = Joi.string()
  .required()
  .custom((s) => (s.length > 200 ? s.slice(0, 200) : s));
const roleSchema = Joi.string()
  .required()
  .custom((s) => (s.length > 10 ? s.slice(0, 10) : s));
const assignmentNameSchema = Joi.string()
  .required()
  .custom((s) => (s.length > 100 ? s.slice(0, 100) : s));
const datetimeSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)
  .optional();
const commentSchema = Joi.string()
  .required()
  .custom((s) => (s.length > 500 ? s.slice(0, 500) : s));
const passwordSchema = Joi.string().min(4).max(16).required();
const userNameSchema = Joi.string().email({ tlds: false }).required();

const openSearchSchema = Joi.string()
  .trim()
  .max(50)
  .allow('')
  .custom((s) => s.toLowerCase());

// completed schema
const addCourseSchema = Joi.object({
  termCode: termCodeSchema,
  courseName: courseNameSchema,
  section: sectionSchema,
});

const CourseSchema = Joi.object({
  termCode: termCodeSchema,
  section: sectionSchema,
});

const memberSchema = Joi.object({
  memberID: memberIDSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  role: roleSchema,
});

const courseMemberSchema = Joi.object({
  termCode: termCodeSchema,
  section: sectionSchema,
  lastName: nameSchema,
  firstName: nameSchema,
  userName: userNameSchema,
  password: passwordSchema,
});

const courseMemberSchema2 = Joi.object({
  lastName: nameSchema,
  firstName: nameSchema,
  userName: userNameSchema,
  password: passwordSchema,
});

const courseRoleSchema = Joi.object({
  termCode: termCodeSchema,
  section: sectionSchema,
  role: roleSchema.optional(),
});

const deleteCourseMemberSchema = Joi.object({
  termCode: termCodeSchema,
  section: sectionSchema,
  userName: userNameSchema,
});

const signupSheetSchema = Joi.object({
  termCode: termCodeSchema,
  section: sectionSchema,
  assignmentName: assignmentNameSchema,
  notBefore: datetimeSchema,
  notAfter: datetimeSchema,
});

const signupSlotSchema = Joi.object({
  signupSheetID: numberSchema,
  start: datetimeSchema.required(),
  slotDuration: numberSchema.min(1).max(240),
  numSlots: numberSchema.min(1).max(99),
  maxMembers: numberSchema.min(1).max(99),
});

const signupSlotDetailSchema = Joi.object({
  signupSlotID: numberSchema,
  startTime: datetimeSchema,
  endTime: datetimeSchema,
  maxMembers: numberSchema.min(1).max(99).optional(),
});

const signupRecordSchema = Joi.object({
  signupSheetID: numberSchema,
  signupSlotID: numberSchema,
  memberID: memberIDSchema,
});

const deleteSignupRecordSchema = Joi.object({
  signupSheetID: numberSchema,
  memberID: memberIDSchema,
});

const gradeSchema = Joi.object({
  signupSlotID: numberSchema,
  userName: userNameSchema,
  base_mark: floatNumberSchema.max(999),
  bonus: floatNumberSchema.max(100),
  penalty: floatNumberSchema.max(100),
  comment: commentSchema,
});

const userNamePasswordSchema = Joi.object({
  userName: userNameSchema,
  password: passwordSchema,
});

const auditSchema = Joi.object({
  userName: userNameSchema,
  signupSlotID: numberSchema,
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
  numberSchema,
  addCourseSchema,
  CourseSchema,
  memberSchema,
  courseMemberSchema,
  courseMemberSchema2,
  courseRoleSchema,
  deleteCourseMemberSchema,
  signupSheetSchema,
  signupSlotSchema,
  signupSlotDetailSchema,
  signupRecordSchema,
  deleteSignupRecordSchema,
  gradeSchema,
  userNameSchema,
  userNamePasswordSchema,
  openSearchSchema,
  auditSchema,
};
