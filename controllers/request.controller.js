const db = require('../models');
const { CollaborationRequest, RequestNegotiation, Creator, Brand, User, RateCard, Contract, Conversation, Payment } = db;
const paymentController = require('./payment.controller');

// Create request (Brand)
exports.createRequest = async (req, res) => {
  try {
    const brand = req.brand;
    const data = req.body;

    // Check if creator exists and is not suspended
    const creator = await Creator.findByPk(data.creatorId);
    if (!creator) {
      return res.status(404).json({ success: false, message: 'Creator not found' });
    }

    // Check if creator is suspended
    if (creator.suspendedUntil && new Date(creator.suspendedUntil) > new Date()) {
      const suspendedUntil = new Date(creator.suspendedUntil);
      return res.status(403).json({
        success: false,
        message: 'This creator is currently suspended and cannot accept new requests.',
        suspended: true,
        suspendedUntil: suspendedUntil.toISOString()
      });
    }

    // Check usage limits (optional - skip if no limit set)
    // Tier-based limits could be implemented here in the future

    // Generate unique reference number
    const referenceNumber = CollaborationRequest.generateReferenceNumber();

    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Map frontend fields to model fields
    const request = await CollaborationRequest.create({
      referenceNumber,
      brandId: brand.id,
      creatorId: data.creatorId,
      // Map campaignTitle -> title, campaignBrief -> description
      title: data.campaignTitle || data.title,
      description: data.campaignBrief || data.description,
      contentRequirements: data.requirements,
      // Budget mapping
      proposedBudget: data.budgetAmount || data.proposedBudget,
      // Timeline mapping
      proposedStartDate: data.startDate,
      proposedEndDate: data.endDate,
      draftDeadline: data.contentDeadline,
      // Platform - default to common platforms if not specified
      targetPlatforms: data.targetPlatforms || ['instagram'],
      // Optional fields
      hashtags: data.hashtags || [],
      mentions: data.mentions || [],
      deliverables: data.selectedServices || data.deliverables || [],
      brandNotes: data.brandNotes,
      status: 'pending',
      // Set 24-hour expiration
      expiresAt
    });

    // Create conversation for this request
    await Conversation.create({
      requestId: request.id,
      creatorId: data.creatorId,
      brandId: brand.id
    });

    // Increment active campaigns count
    await brand.increment('activeCampaignsCount');

    // TODO: Send notification to creator

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ success: false, message: 'Failed to create request' });
  }
};

// Get brand's sent requests
exports.getBrandRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = { brandId: req.brand.id };
    if (status) where.status = status;

    const requests = await CollaborationRequest.findAndCountAll({
      where,
      include: [{ model: Creator, as: 'creator', attributes: ['id', 'displayName', 'profileImage', 'tier'] }],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        requests: requests.rows,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: requests.count, totalPages: Math.ceil(requests.count / limit) }
      }
    });
  } catch (error) {
    console.error('Get brand requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to get requests' });
  }
};

// Get brand request detail
exports.getBrandRequestDetail = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({
      where: { id: req.params.id, brandId: req.brand.id },
      include: [
        { model: Creator, as: 'creator' },
        { model: Brand, as: 'brand' },
        { model: Contract, as: 'contract' },
        { model: RequestNegotiation, as: 'negotiations', order: [['createdAt', 'ASC']] }
      ]
    });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });

    // Parse submitted content if it exists
    const requestData = request.toJSON();
    if (requestData.submittedContentUrls) {
      try {
        requestData.submittedContent = JSON.parse(requestData.submittedContentUrls);
      } catch (e) {
        // If it's not JSON, it's the old format
        requestData.submittedContent = { contentUrls: requestData.submittedContentUrls };
      }
    }

    res.json({ success: true, data: requestData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get request' });
  }
};

// Cancel request
exports.cancelRequest = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({ where: { id: req.params.id, brandId: req.brand.id } });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['pending', 'viewed', 'negotiating'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel at this stage' });
    }
    await request.update({ status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'brand' });
    await req.brand.decrement('activeCampaigns');
    res.json({ success: true, message: 'Request cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel' });
  }
};

// Approve content and release escrow
exports.approveContent = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({
      where: { id: req.params.id, brandId: req.brand.id }
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (request.status !== 'content_submitted') {
      return res.status(400).json({ success: false, message: 'No content to approve' });
    }

    // Update request status
    await request.update({
      status: 'content_approved',
      contentApprovedAt: new Date()
    });

    // Find and release the escrow payment
    const payment = await Payment.findOne({
      where: { requestId: request.id, status: 'escrow' }
    });

    let escrowReleased = false;
    let creatorPayout = 0;

    if (payment) {
      try {
        await paymentController.releaseEscrow(payment.id, req.userId);
        escrowReleased = true;
        creatorPayout = payment.creatorPayout;
        console.log(`✅ Content approved and escrow released for request ${request.id}`);
      } catch (escrowError) {
        console.error('Escrow release error:', escrowError);
        // Content is approved but escrow release failed - this needs attention
      }
    }

    res.json({
      success: true,
      message: escrowReleased
        ? 'Content approved and payment released to creator'
        : 'Content approved',
      data: {
        escrowReleased,
        creatorPayout: escrowReleased ? creatorPayout : null
      }
    });
  } catch (error) {
    console.error('Approve content error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve' });
  }
};

// Request revision
exports.requestRevision = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({ where: { id: req.params.id, brandId: req.brand.id } });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.status !== 'content_submitted') {
      return res.status(400).json({ success: false, message: 'Cannot request revision' });
    }
    if (request.revisionCount >= request.maxRevisions) {
      return res.status(400).json({ success: false, message: 'Maximum revisions reached' });
    }
    await request.update({
      status: 'revision_requested',
      revisionNotes: req.body.notes,
      revisionCount: request.revisionCount + 1
    });
    res.json({ success: true, message: 'Revision requested' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to request revision' });
  }
};

// Complete collaboration
exports.completeCollaboration = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({ where: { id: req.params.id, brandId: req.brand.id } });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.status !== 'content_approved') {
      return res.status(400).json({ success: false, message: 'Content must be approved first' });
    }
    await request.update({ status: 'completed', completedAt: new Date() });
    await req.brand.decrement('activeCampaigns');
    // TODO: Update creator stats, release final payment
    res.json({ success: true, message: 'Collaboration completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to complete' });
  }
};

// Get creator's received requests
exports.getCreatorRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = { creatorId: req.creator.id };
    if (status) where.status = status;

    const requests = await CollaborationRequest.findAndCountAll({
      where,
      include: [{ model: Brand, as: 'brand', attributes: ['id', 'companyName', 'logo', 'tier'] }],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        requests: requests.rows,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: requests.count, totalPages: Math.ceil(requests.count / limit) }
      }
    });
  } catch (error) {
    console.error('Get creator requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to get requests' });
  }
};

// Get creator request detail
exports.getCreatorRequestDetail = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({
      where: { id: req.params.id, creatorId: req.creator.id },
      include: [
        { model: Brand, as: 'brand' },
        { model: Creator, as: 'creator' },
        { model: Contract, as: 'contract' },
        { model: RequestNegotiation, as: 'negotiations', order: [['createdAt', 'ASC']] }
      ]
    });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });

    // Mark as viewed if pending
    if (request.status === 'pending') {
      await request.update({ status: 'viewed', viewedAt: new Date() });
    }

    // Parse submitted content if it exists
    const requestData = request.toJSON();
    if (requestData.submittedContentUrls) {
      try {
        requestData.submittedContent = JSON.parse(requestData.submittedContentUrls);
      } catch (e) {
        // If it's not JSON, it's the old format
        requestData.submittedContent = { contentUrls: requestData.submittedContentUrls };
      }
    }

    res.json({ success: true, data: requestData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get request' });
  }
};

// Accept request
exports.acceptRequest = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['pending', 'viewed', 'negotiating'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Cannot accept at this stage' });
    }
    await request.update({ status: 'accepted', acceptedAt: new Date() });
    // TODO: Generate contract, notify brand
    res.json({ success: true, message: 'Request accepted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to accept' });
  }
};

// Decline request
exports.declineRequest = async (req, res) => {
  try {
    const { reason, category } = req.body;
    const creator = req.creator;

    // Require a reason for declining
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reason for declining (at least 10 characters)'
      });
    }

    const request = await CollaborationRequest.findOne({ where: { id: req.params.id, creatorId: creator.id } });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['pending', 'viewed'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Cannot decline at this stage' });
    }

    await request.update({
      status: 'declined',
      respondedAt: new Date(),
      declineReason: reason.trim(),
      declineCategory: category || 'other'
    });

    // Increment decline count
    const newDeclineCount = (creator.declineCount || 0) + 1;
    const updateData = { declineCount: newDeclineCount };

    // Check if creator should be suspended (after 2 declines)
    let suspended = false;
    if (newDeclineCount >= 2) {
      const suspendedUntil = new Date();
      suspendedUntil.setDate(suspendedUntil.getDate() + 3); // 3 days suspension

      updateData.suspendedUntil = suspendedUntil;
      updateData.suspensionReason = 'Declined 2 collaboration requests';
      updateData.totalSuspensions = (creator.totalSuspensions || 0) + 1;
      updateData.declineCount = 0; // Reset decline count after suspension
      suspended = true;
    }

    await creator.update(updateData);

    // TODO: Notify brand about the decline

    res.json({
      success: true,
      message: suspended
        ? 'Request declined. Your account has been suspended for 3 days due to declining 2 requests.'
        : 'Request declined',
      suspended,
      suspendedUntil: suspended ? updateData.suspendedUntil : null,
      declineCount: suspended ? 0 : newDeclineCount,
      warning: !suspended && newDeclineCount === 1
        ? 'Warning: Declining one more request will result in a 3-day suspension.'
        : null
    });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(500).json({ success: false, message: 'Failed to decline' });
  }
};

// Send counter offer
exports.sendCounterOffer = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.negotiationRound >= 3) {
      return res.status(400).json({ success: false, message: 'Maximum negotiations reached' });
    }

    await RequestNegotiation.create({
      requestId: request.id,
      proposedBy: 'creator',
      proposedAmount: req.body.proposedAmount,
      proposedServices: req.body.proposedServices,
      message: req.body.message,
      round: request.negotiationRound + 1
    });

    await request.update({ status: 'negotiating', negotiationRound: request.negotiationRound + 1 });
    res.json({ success: true, message: 'Counter offer sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send counter offer' });
  }
};

// Submit content
exports.submitContent = async (req, res) => {
  try {
    const request = await CollaborationRequest.findOne({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['in_progress', 'revision_requested'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Cannot submit content' });
    }

    // Support both old format (contentUrls) and new format (contentLinks, notes)
    const submittedContent = req.body.contentLinks ? {
      contentLinks: req.body.contentLinks,
      notes: req.body.notes || ''
    } : req.body.contentUrls;

    await request.update({
      status: 'content_submitted',
      submittedContentUrls: typeof submittedContent === 'object' ? JSON.stringify(submittedContent) : submittedContent,
      contentSubmittedAt: new Date()
    });
    res.json({ success: true, message: 'Content submitted successfully' });
  } catch (error) {
    console.error('Submit content error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit content' });
  }
};

// Get request detail (shared)
exports.getRequestDetail = async (req, res) => {
  try {
    const request = await CollaborationRequest.findByPk(req.params.id, {
      include: [
        { model: Creator, as: 'creator' },
        { model: Brand, as: 'brand' },
        { model: Contract, as: 'contract' }
      ]
    });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });

    // Check authorization
    const userId = req.userId;
    const creator = await Creator.findOne({ where: { userId } });
    const brand = await Brand.findOne({ where: { userId } });

    if ((!creator || creator.id !== request.creatorId) && (!brand || brand.id !== request.brandId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get request' });
  }
};

// Get request timeline
exports.getRequestTimeline = async (req, res) => {
  try {
    const request = await CollaborationRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });

    const timeline = [];
    if (request.createdAt) timeline.push({ event: 'created', date: request.createdAt });
    if (request.viewedAt) timeline.push({ event: 'viewed', date: request.viewedAt });
    if (request.acceptedAt) timeline.push({ event: 'accepted', date: request.acceptedAt });
    if (request.contentSubmittedAt) timeline.push({ event: 'content_submitted', date: request.contentSubmittedAt });
    if (request.contentApprovedAt) timeline.push({ event: 'content_approved', date: request.contentApprovedAt });
    if (request.completedAt) timeline.push({ event: 'completed', date: request.completedAt });

    res.json({ success: true, data: timeline.sort((a, b) => new Date(a.date) - new Date(b.date)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get timeline' });
  }
};

// Get negotiation history
exports.getNegotiationHistory = async (req, res) => {
  try {
    const negotiations = await RequestNegotiation.findAll({
      where: { requestId: req.params.id },
      order: [['createdAt', 'ASC']]
    });
    res.json({ success: true, data: negotiations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get history' });
  }
};
