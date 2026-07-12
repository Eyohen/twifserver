// middleware/errorHandler.js - Comprehensive Error Handling

/**
 * Global error handling middleware for production-ready error responses
 */
class ErrorHandler {

  /**
   * Main error handling middleware
   */
  static handle(error, req, res, next) {
    const requestId = req.headers['x-request-id'] || `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    console.error(`🚨 [ErrorHandler-${requestId}] Error caught:`, {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      url: req.url,
      method: req.method,
      merchantId: req.merchant?.id,
      timestamp: new Date().toISOString()
    });

    // Handle different error types
    let statusCode = 500;
    let errorResponse = {
      success: false,
      requestId,
      timestamp: new Date().toISOString()
    };

    // Validation errors
    if (error.name === 'ValidationError' || error.message.includes('Validation failed')) {
      statusCode = 400;
      errorResponse.error = 'Validation Failed';
      errorResponse.message = error.message;
      errorResponse.details = error.details || null;
    }

    // Authentication errors
    else if (error.name === 'UnauthorizedError' || error.message.includes('Authentication')) {
      statusCode = 401;
      errorResponse.error = 'Authentication Required';
      errorResponse.message = 'Invalid or missing authentication credentials';
    }

    // Authorization errors
    else if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
      statusCode = 403;
      errorResponse.error = 'Access Forbidden';
      errorResponse.message = 'Insufficient permissions to access this resource';
    }

    // Resource not found
    else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
      statusCode = 404;
      errorResponse.error = 'Resource Not Found';
      errorResponse.message = 'The requested resource could not be found';
    }

    // Rate limiting errors
    else if (error.name === 'TooManyRequestsError' || statusCode === 429) {
      statusCode = 429;
      errorResponse.error = 'Rate Limit Exceeded';
      errorResponse.message = 'Too many requests, please try again later';
    }

    // Database errors
    else if (error.name === 'SequelizeError' || error.name.includes('Sequelize')) {
      statusCode = 500;
      errorResponse.error = 'Database Error';
      errorResponse.message = 'A database error occurred while processing your request';

      // Log detailed database error for debugging (but don't expose to client)
      console.error(`🗄️ [Database Error-${requestId}]`, {
        originalError: error.original || error.message,
        sql: error.sql,
        parameters: error.parameters
      });
    }

    // Blockchain/Web3 errors
    else if (error.message.includes('blockchain') || error.message.includes('web3') || error.message.includes('provider')) {
      statusCode = 503;
      errorResponse.error = 'Blockchain Service Unavailable';
      errorResponse.message = 'Blockchain network is temporarily unavailable. Please try again later.';
    }

    // Payment processing errors
    else if (error.message.includes('payment') || error.message.includes('transaction')) {
      statusCode = 422;
      errorResponse.error = 'Payment Processing Error';
      errorResponse.message = 'Unable to process payment. Please check your transaction details and try again.';
    }

    // BigInt serialization errors (should be rare now but good to catch)
    else if (error.message.includes('BigInt') || error.message.includes('serialize')) {
      statusCode = 500;
      errorResponse.error = 'Data Processing Error';
      errorResponse.message = 'An error occurred while processing blockchain data';

      // Alert developers immediately about BigInt issues
      console.error(`🚨 [CRITICAL-BigInt-${requestId}] BigInt serialization error detected:`, error);
    }

    // Webhook errors
    else if (error.message.includes('webhook')) {
      statusCode = 502;
      errorResponse.error = 'Webhook Delivery Failed';
      errorResponse.message = 'Failed to deliver webhook notification';
    }

    // Network/timeout errors
    else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      statusCode = 504;
      errorResponse.error = 'Service Timeout';
      errorResponse.message = 'The service took too long to respond. Please try again.';
    }

    // Generic server errors
    else {
      statusCode = 500;
      errorResponse.error = 'Internal Server Error';
      errorResponse.message = 'An unexpected error occurred while processing your request';
    }

    // In development, include more error details
    if (process.env.NODE_ENV === 'development') {
      errorResponse.debug = {
        stack: error.stack,
        originalError: error.message
      };
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
  }

  /**
   * Handle 404 errors (no route matched)
   */
  static notFound(req, res, next) {
    const error = new Error(`Route not found: ${req.method} ${req.url}`);
    error.name = 'NotFoundError';
    next(error);
  }

  /**
   * Handle async errors in routes
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Validation error formatter
   */
  static formatValidationError(validationErrors) {
    if (Array.isArray(validationErrors)) {
      return validationErrors.map(err => ({
        field: err.field || err.path,
        message: err.message,
        value: err.value
      }));
    }
    return [{ message: validationErrors.message || 'Validation failed' }];
  }

  /**
   * Create application error with specific type
   */
  static createError(type, message, details = null) {
    const error = new Error(message);
    error.name = type;
    error.details = details;
    return error;
  }

  /**
   * Log critical errors that need immediate attention
   */
  static logCriticalError(error, context = {}) {
    const criticalLog = {
      level: 'CRITICAL',
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      environment: process.env.NODE_ENV,
      pid: process.pid,
      memory: process.memoryUsage()
    };

    console.error('🚨🚨🚨 CRITICAL ERROR 🚨🚨🚨', JSON.stringify(criticalLog, null, 2));

    // In production, this is where you'd send alerts to monitoring services
    // Example: Slack, email, PagerDuty, etc.
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement alerting system
      // await sendSlackAlert(criticalLog);
      // await sendEmailAlert(criticalLog);
    }
  }

  /**
   * Graceful shutdown handler
   */
  static setupGracefulShutdown() {
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error);
      ErrorHandler.logCriticalError(error, { type: 'uncaughtException' });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      ErrorHandler.logCriticalError(new Error(reason), {
        type: 'unhandledRejection',
        promise: promise.toString()
      });
    });

    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      process.exit(0);
    });
  }
}

module.exports = ErrorHandler;