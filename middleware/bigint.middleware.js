// middleware/bigint.middleware.js - BigInt Serialization Middleware

const { serializeBigInts, validateNoBigInts, safeStringify } = require('../utils/bigint.serializer');

/**
 * Express middleware to handle BigInt serialization in responses
 */
function bigIntSerializationMiddleware(req, res, next) {
  // Store original json method
  const originalJson = res.json;

  // Override res.json to handle BigInt values
  res.json = function(obj) {
    try {
      // Check if object contains BigInt values
      if (!validateNoBigInts(obj)) {
        console.log('🔧 [BigInt-Middleware] Serializing BigInt values in response');
        obj = serializeBigInts(obj);
      }

      // Call original json method
      return originalJson.call(this, obj);
    } catch (error) {
      console.error('❌ [BigInt-Middleware] JSON serialization error:', error.message);

      // If serialization fails, try safe stringify
      try {
        const safeObj = serializeBigInts(obj);
        return originalJson.call(this, safeObj);
      } catch (fallbackError) {
        console.error('❌ [BigInt-Middleware] Fallback serialization also failed:', fallbackError.message);

        // Ultimate fallback - return error response
        return originalJson.call(this, {
          success: false,
          error: 'Serialization error',
          message: 'Unable to serialize response data'
        });
      }
    }
  };

  next();
}

/**
 * Express error handler for BigInt serialization errors
 */
function bigIntErrorHandler(err, req, res, next) {
  // Check if this is a BigInt serialization error
  if (err.message && err.message.includes('serialize a BigInt')) {
    console.error('❌ [BigInt-Error] Caught BigInt serialization error:', {
      error: err.message,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    // Return a safe error response
    return res.status(500).json({
      success: false,
      error: 'Data serialization error',
      message: 'Unable to process response data. This has been logged for investigation.',
      requestId: `error-${Date.now()}`
    });
  }

  // Pass to next error handler if not a BigInt error
  next(err);
}

module.exports = {
  bigIntSerializationMiddleware,
  bigIntErrorHandler
};