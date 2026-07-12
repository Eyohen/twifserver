const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = {
  // Upload image
  uploadImage: async (file, options = {}) => {
    try {
      const result = await cloudinary.uploader.upload(file, {
        resource_type: 'image',
        folder: options.folder || 'creatorsworld/images',
        transformation: options.transformation || [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ],
        ...options
      });
      return result;
    } catch (error) {
      console.error('Cloudinary upload image error:', error);
      throw new Error('Failed to upload image');
    }
  },

  // Upload avatar (with specific transformations)
  uploadAvatar: async (file) => {
    try {
      const result = await cloudinary.uploader.upload(file, {
        resource_type: 'image',
        folder: 'creatorsworld/avatars',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      });
      return result;
    } catch (error) {
      console.error('Cloudinary upload avatar error:', error);
      throw new Error('Failed to upload avatar');
    }
  },

  // Upload video
  uploadVideo: async (file, options = {}) => {
    try {
      const result = await cloudinary.uploader.upload(file, {
        resource_type: 'video',
        folder: options.folder || 'creatorsworld/videos',
        eager: [
          { streaming_profile: 'full_hd', format: 'm3u8' } // HLS adaptive streaming
        ],
        eager_async: true,
        ...options
      });
      return result;
    } catch (error) {
      console.error('Cloudinary upload video error:', error);
      throw new Error('Failed to upload video');
    }
  },

  // Upload document (PDF, etc.)
  uploadDocument: async (file, options = {}) => {
    try {
      const result = await cloudinary.uploader.upload(file, {
        resource_type: 'raw',
        folder: options.folder || 'creatorsworld/documents',
        ...options
      });
      return result;
    } catch (error) {
      console.error('Cloudinary upload document error:', error);
      throw new Error('Failed to upload document');
    }
  },

  // Delete file
  deleteFile: async (publicId, resourceType = 'image') => {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });
      return result;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error('Failed to delete file');
    }
  },

  // Generate upload signature for direct browser uploads
  generateSignature: (options = {}) => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp,
      folder: options.folder || 'creatorsworld',
      ...options.params
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );

    return {
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder: params.folder
    };
  },

  // Get optimized URL
  getOptimizedUrl: (publicId, options = {}) => {
    return cloudinary.url(publicId, {
      secure: true,
      quality: 'auto',
      fetch_format: 'auto',
      ...options
    });
  },

  // Get thumbnail URL
  getThumbnailUrl: (publicId, width = 150, height = 150) => {
    return cloudinary.url(publicId, {
      secure: true,
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto'
    });
  }
};
