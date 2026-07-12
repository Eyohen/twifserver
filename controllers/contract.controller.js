const db = require('../models');
const { Contract, CollaborationRequest, ContractTemplate, Creator, Brand } = db;

// Get contract by request
exports.getContractByRequest = async (req, res) => {
  try {
    const contract = await Contract.findOne({
      where: { requestId: req.params.requestId },
      include: [{ model: CollaborationRequest, as: 'request' }]
    });
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get contract' });
  }
};

// Get contract by ID
exports.getContractById = async (req, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id, {
      include: [
        { model: CollaborationRequest, as: 'request' },
        { model: Creator, as: 'creator' },
        { model: Brand, as: 'brand' }
      ]
    });
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get contract' });
  }
};

// Sign contract
exports.signContract = async (req, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });

    const { signature } = req.body;
    const userId = req.userId;

    // Determine signer type
    const creator = await Creator.findOne({ where: { userId } });
    const brand = await Brand.findOne({ where: { userId } });

    if (creator && creator.id === contract.creatorId) {
      if (contract.creatorSignedAt) {
        return res.status(400).json({ success: false, message: 'Already signed' });
      }
      await contract.update({
        creatorSignature: signature,
        creatorSignedAt: new Date()
      });
    } else if (brand && brand.id === contract.brandId) {
      if (contract.brandSignedAt) {
        return res.status(400).json({ success: false, message: 'Already signed' });
      }
      await contract.update({
        brandSignature: signature,
        brandSignedAt: new Date()
      });
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to sign' });
    }

    // Check if both parties signed
    const updated = await Contract.findByPk(contract.id);
    if (updated.creatorSignedAt && updated.brandSignedAt) {
      await updated.update({ status: 'signed', signedAt: new Date() });
      // Update request status
      await CollaborationRequest.update(
        { status: 'contract_signed' },
        { where: { id: contract.requestId } }
      );
    }

    res.json({ success: true, message: 'Contract signed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to sign contract' });
  }
};

// Download contract as PDF
exports.downloadContract = async (req, res) => {
  try {
    // TODO: Implement PDF generation
    res.status(501).json({ success: false, message: 'PDF download not implemented yet' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to download' });
  }
};

// Get my contracts
exports.getMyContracts = async (req, res) => {
  try {
    const userId = req.userId;
    const creator = await Creator.findOne({ where: { userId } });
    const brand = await Brand.findOne({ where: { userId } });

    const where = {};
    if (creator) where.creatorId = creator.id;
    else if (brand) where.brandId = brand.id;
    else return res.status(400).json({ success: false, message: 'Invalid user type' });

    const contracts = await Contract.findAll({
      where,
      include: [
        { model: CollaborationRequest, as: 'request' },
        { model: Creator, as: 'creator', attributes: ['displayName', 'avatarUrl'] },
        { model: Brand, as: 'brand', attributes: ['companyName', 'logo'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get contracts' });
  }
};
