const cloudinaryService = require('../services/cloudinary.service');

// Helper to convert buffer to data URI
const bufferToDataUri = (file) => {
  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
};

// Upload image
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Convert buffer to data URI for Cloudinary
    const dataUri = bufferToDataUri(req.file);

    const result = await cloudinaryService.uploadImage(dataUri, {
      folder: 'creatorsworld/images'
    });

    res.json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id
      }
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
};

// Upload video
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const dataUri = bufferToDataUri(req.file);

    const result = await cloudinaryService.uploadVideo(dataUri, {
      folder: 'creatorsworld/videos'
    });

    res.json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id
      }
    });
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload video' });
  }
};

// Upload document
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const dataUri = bufferToDataUri(req.file);

    const result = await cloudinaryService.uploadDocument(dataUri, {
      folder: 'creatorsworld/documents'
    });

    res.json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id
      }
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

// Delete file
exports.deleteFile = async (req, res) => {
  try {
    const { publicId } = req.params;
    await cloudinaryService.deleteFile(publicId);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
};

// Get upload signature for direct browser uploads
exports.getUploadSignature = async (req, res) => {
  try {
    const signature = cloudinaryService.generateSignature({
      folder: req.query.folder || 'creatorsworld'
    });
    res.json({ success: true, data: signature });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate signature' });
  }
};
