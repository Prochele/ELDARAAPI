const express = require('express');
const multer = require('multer');
const fileController = require('../controllers/file.controller');
const sessionMiddleware = require('../middlewares/session.middleware');
const {guard,fileTarget}=require('../middlewares/careAccess.middleware');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Upload
router.post(
  '/upload',
  sessionMiddleware,
  upload.single('file'),
  guard(fileTarget),
  fileController.uploadFile
);

// View (NEW)
router.get(
  '/view/:file_id',
  sessionMiddleware,
  guard(fileTarget),
  fileController.getFileView
);

router.delete(
  '/delete/:file_id',
  sessionMiddleware,
  guard(fileTarget),
  fileController.deleteFile
);

module.exports = router;
