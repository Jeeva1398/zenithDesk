const multer = require('multer');
const ApiError = require('../utils/ApiError');

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: [413, 'File is too large'],
  LIMIT_FILE_COUNT: [400, 'Send one file at a time'],
  LIMIT_UNEXPECTED_FILE: [400, 'The file must be sent in the multipart field "file"'],
};

// Held in memory rather than streamed to disk: the file is small (capped
// here), and its first bytes have to be checked before it is allowed to land
// anywhere at all.
function singleUpload(maxBytes) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 5 },
  }).single('file');

  // multer's own errors are not ApiErrors, so without this a too-large file
  // would reach the client as a 500.
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (!err) return next();
      const [status, message] = MULTER_MESSAGES[err.code] || [400, 'Could not read the upload'];
      return next(new ApiError(status, message));
    });
  };
}

module.exports = singleUpload;
