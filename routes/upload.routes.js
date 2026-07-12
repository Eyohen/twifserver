const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/upload.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const videoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'), false);
  }
};

const documentFilter = (req, file, cb) => {
  const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word documents are allowed!'), false);
  }
};

const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

router.use(verifyToken);

// Upload image
router.post('/image', uploadImage.single('file'), uploadController.uploadImage);

// Upload video
router.post('/video', uploadVideo.single('file'), uploadController.uploadVideo);

// Upload document
router.post('/document', uploadDocument.single('file'), uploadController.uploadDocument);

// Delete uploaded file
router.delete('/:publicId', uploadController.deleteFile);

// Generate upload signature (for direct browser uploads)
router.get('/signature', uploadController.getUploadSignature);

module.exports = router;
