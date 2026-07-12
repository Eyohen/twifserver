'use strict';

module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define('Review', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'CollaborationRequests',
        key: 'id'
      }
    },
    // Reviewer
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    reviewerType: {
      type: DataTypes.ENUM('brand', 'creator'),
      allowNull: false
    },
    // Reviewee
    revieweeId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    revieweeType: {
      type: DataTypes.ENUM('brand', 'creator'),
      allowNull: false
    },
    // Rating
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    // Detailed Ratings
    communicationRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    qualityRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    professionalismRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    timelinessRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    // Review Content
    title: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Visibility
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Response
    response: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Moderation
    isApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isFlagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    flagReason: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'Reviews',
    timestamps: true,
    indexes: [
      { fields: ['requestId'] },
      { fields: ['reviewerId'] },
      { fields: ['revieweeId'] },
      { fields: ['revieweeType'] },
      { fields: ['rating'] },
      { fields: ['isPublic'] }
    ]
  });

  Review.associate = function(models) {
    Review.belongsTo(models.CollaborationRequest, {
      foreignKey: 'requestId',
      as: 'request'
    });
  };

  return Review;
};
