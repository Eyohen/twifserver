const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../models');
const { createTwifInvoiceHtml, getTwifStoreDetails } = require('../utils/twifInvoiceTemplate');
const { sendEmail } = require('../services/email.service');
const cloudinaryService = require('../services/cloudinary.service');

const router = express.Router();
const { StaffUser, Customer, Invoice, OrderSheet, Fabric, SentInvoice, OmsNotification, InventoryAllocation } = db;

const notifyRoles = (roles, message, metadata = {}) => Promise.all(
  roles.map((recipientRole) => OmsNotification.create({
    recipientRole,
    channel: 'Inventory',
    message,
    metadata,
  }))
);

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    callback(file.mimetype.startsWith('image/') ? null : new Error('Only image files are allowed'), file.mimetype.startsWith('image/'));
  },
});

const knownStaffAccounts = {
  '08000000001': { pin: 'owner26', displayName: 'Jenni', role: 'owner', store: 'all' },
  '08000000002': { pin: 'admin26', displayName: 'Jim', role: 'admin', store: 'all' },
  '08000000003': { pin: 'store26', displayName: 'Bola', role: 'store_manager', store: 'all' },
  '08000000004': { pin: 'accounts26', displayName: 'Funke', role: 'accounts', store: 'all' },
  '08000000005': { pin: 'production26', displayName: 'Tunde', role: 'production_manager', store: 'production' },
  '08000000006': { pin: 'inventory26', displayName: 'Kemi', role: 'inventory_manager', store: 'all' },
  '08000000007': { pin: 'tailor26', displayName: 'Segun', role: 'tailor', store: 'production', tailorDepartment: 'suit', tailorGrade: 4 },
};

const verifiedStaffForProfile = async (phone, pin) => {
  let staffUser = await StaffUser.findOne({ where: { phone } });
  if (staffUser) {
    return pin && await bcrypt.compare(pin, staffUser.pinHash) ? staffUser : null;
  }

  const knownAccount = knownStaffAccounts[phone];
  if (!knownAccount || pin !== knownAccount.pin) return null;
  const { pin: knownPin, ...staffDetails } = knownAccount;
  const [createdStaff] = await StaffUser.findOrCreate({
    where: { phone },
    defaults: {
      phone,
      pinHash: await bcrypt.hash(knownPin, 12),
      ...staffDetails,
    },
  });
  return createdStaff;
};

const invoiceNumber = () => {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(Math.random() * 90000) + 10000);
  return `TWIF-${year}-${suffix}`;
};

const trackingBaseUrl = () => (
  process.env.TRACKING_BASE_URL ||
  process.env.FRONTEND_URL ||
  'http://localhost:5173'
).replace(/\/+$/, '');

const trackingToken = () => crypto.randomBytes(8).toString('hex');

const inventoryCategories = new Set([
  'Suiting',
  'Shirting',
  'Jacket',
  'Trouser',
  'Native',
  'Bridal',
  'Lining',
  'Trim',
  'Accessories',
  'Cloth',
  'Add Ons',
]);

const trackingTokenFromUrl = (value = '') => {
  const match = String(value).match(/\/c\/([^/?#]+)/);
  return match?.[1] || '';
};

const trackingUrlForToken = (token) => `${trackingBaseUrl()}/c/${token}`;

const buildInvoiceHtmlPayload = (body = {}) => {
  const token = body.trackingToken || trackingTokenFromUrl(body.trackingUrl) || trackingToken();

  return {
    store: body.store || 'lekki',
    invoiceNumber: body.invoiceNumber || invoiceNumber(),
    invoiceDate: body.invoiceDate || new Date(),
    dueDate: body.dueDate || new Date(),
    customer: body.customer || {},
    items: Array.isArray(body.items) ? body.items : [],
    subtotal: body.subtotal,
    eliteDiscountAmount: body.eliteDiscountAmount || 0,
    storeCreditApplied: body.storeCreditApplied || 0,
    balanceDue: body.balanceDue,
    paymentStatus: body.paymentStatus || 'partial_paid',
    trackingToken: token,
    trackingUrl: body.trackingUrl || trackingUrlForToken(token),
    notes: body.notes,
  };
};

const plainTextInvoice = (payload) => {
  const lines = [
    `Invoice ${payload.invoiceNumber}`,
    `Store: ${getTwifStoreDetails(payload.store).label}`,
    `Customer: ${payload.customer?.name || payload.customer?.fullName || 'Customer'}`,
    `Payment status: ${payload.paymentStatus === 'fully_paid' ? 'Fully Paid' : 'Partial Paid'}`,
    `Balance due: ₦${Number(payload.balanceDue || 0).toLocaleString('en-NG')}`,
    '',
    'Items:',
    ...(payload.items || []).map((item) => {
      const amount = Number(item.amount ?? (Number(item.rate || 0) * Number(item.quantity || 1)));
      return `- ${item.description || item.name}: ₦${amount.toLocaleString('en-NG')}`;
    }),
    '',
    payload.trackingUrl ? `Track your order: ${payload.trackingUrl}` : '',
  ];

  return lines.filter(Boolean).join('\n');
};

const paymentStatusLabel = (status) => (status === 'fully_paid' ? 'Fully Paid' : 'Partial Paid');

const customerTrackingStatus = (status) => {
  if (status === 'Ready' || status === 'Ready for Collection') return 'Ready for Collection';
  return 'In Progress';
};

const formatSentInvoice = (invoice) => {
  const payload = invoice.payload || {};
  const firstItem = Array.isArray(payload.items) ? payload.items[0] : null;

  return {
    invoiceNumber: invoice.invoiceNumber,
    customer: invoice.customerName,
    store: invoice.store === 'ikeja' ? 'Ikeja' : 'Lekki',
    createdBy: invoice.createdByName,
    createdAt: new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(invoice.createdAt || new Date()),
    total: Number(invoice.total || 0),
    emailStatus: invoice.emailStatus === 'failed' ? 'Failed' : 'Sent',
    paymentStatus: paymentStatusLabel(invoice.paymentStatus),
    orderStatus: invoice.orderStatus || paymentStatusLabel(invoice.paymentStatus),
    accountApprovalStatus: payload.accountApprovalStatus || 'Pending Accounts',
    item: firstItem?.description || '',
    pieces: Number(firstItem?.quantity || 1),
    deliveryDate: payload.dueDate || payload.deliveryDate || '',
    itemNote: firstItem?.note || (Array.isArray(payload.notes) ? payload.notes[0] : '') || '',
    trackingToken: payload.trackingToken || trackingTokenFromUrl(payload.trackingUrl),
    trackingUrl: payload.trackingUrl || (payload.trackingToken ? trackingUrlForToken(payload.trackingToken) : ''),
    orderSheet: payload.orderSheet || null,
  };
};

const findSentInvoiceByTrackingToken = async (token) => {
  const invoices = await SentInvoice.findAll({
    order: [['createdAt', 'DESC']],
  });

  return invoices.find((invoice) => {
    const payload = invoice.payload || {};
    return payload.trackingToken === token || trackingTokenFromUrl(payload.trackingUrl) === token;
  });
};

const normalizedCustomerIdentity = (invoice) => {
  const phone = String(invoice.customerPhone || '').replace(/\D/g, '');
  const email = String(invoice.customerEmail || '').trim().toLowerCase();
  return { phone, email };
};

const invoicesForCustomer = async (sourceInvoice) => {
  const identity = normalizedCustomerIdentity(sourceInvoice);
  const invoices = await SentInvoice.findAll({ order: [['createdAt', 'DESC']] });

  return invoices.filter((invoice) => {
    const candidate = normalizedCustomerIdentity(invoice);
    if (identity.phone) return candidate.phone === identity.phone;
    if (identity.email) return candidate.email === identity.email;
    return invoice.id === sourceInvoice.id;
  });
};

router.get('/bootstrap', asyncHandler(async (req, res) => {
  const [staffCount, customerCount, invoiceCount, fabricCount] = await Promise.all([
    StaffUser.count(),
    Customer.count(),
    Invoice.count(),
    Fabric.count(),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        staffCount,
        customerCount,
        invoiceCount,
        fabricCount,
      },
      roles: ['owner', 'admin', 'store_manager', 'accounts', 'production_manager', 'inventory_manager', 'tailor'],
      stores: ['ikeja', 'lekki'],
    },
  });
}));

router.get('/stores', (req, res) => {
  res.json({
    success: true,
    data: {
      stores: [
        getTwifStoreDetails('lekki'),
        getTwifStoreDetails('ikeja'),
      ],
    },
  });
});

router.post('/staff', asyncHandler(async (req, res) => {
  const {
    phone,
    pin,
    displayName,
    role,
    store = 'all',
    dateOfBirth,
    tailorDepartment,
    tailorGrade,
    ownerPhone,
    ownerPin,
  } = req.body;

  const owner = await verifiedStaffForProfile(ownerPhone, ownerPin);
  if (!owner || owner.role !== 'owner') {
    return res.status(403).json({ success: false, message: 'Only the Owner can create staff accounts' });
  }

  if (!phone || !pin || !displayName || !role) {
    return res.status(400).json({
      success: false,
      message: 'phone, pin, displayName, and role are required',
    });
  }
  if (role === 'tailor' && !tailorDepartment) {
    return res.status(400).json({ success: false, message: 'A department is required for tailor accounts' });
  }

  const pinHash = await bcrypt.hash(pin, 12);
  const staffUser = await StaffUser.create({
    phone,
    pinHash,
    displayName,
    role,
    store,
    dateOfBirth,
    tailorDepartment,
    tailorGrade,
  });

  res.status(201).json({
    success: true,
    data: {
      staffUser: {
        id: staffUser.id,
        phone: staffUser.phone,
        displayName: staffUser.displayName,
        role: staffUser.role,
        store: staffUser.store,
        status: staffUser.status,
        dateOfBirth: staffUser.dateOfBirth,
        tailorDepartment: staffUser.tailorDepartment,
        tailorGrade: staffUser.tailorGrade,
      },
    },
  });
}));

router.get('/staff', asyncHandler(async (req, res) => {
  const staffUsers = await StaffUser.findAll({
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'phone', 'displayName', 'role', 'store', 'status', 'profileImageUrl', 'dateOfBirth', 'lastLoginAt', 'tailorDepartment', 'tailorGrade', 'createdAt'],
  });

  res.json({ success: true, data: { staffUsers } });
}));

router.patch('/staff/:id', asyncHandler(async (req, res) => {
  const { ownerPhone, ownerPin, pin, ...requestedUpdates } = req.body;
  const owner = await verifiedStaffForProfile(ownerPhone, ownerPin);
  if (!owner || owner.role !== 'owner') {
    return res.status(403).json({ success: false, message: 'Only the Owner can update staff accounts' });
  }

  const staffUser = await StaffUser.findByPk(req.params.id);
  if (!staffUser) return res.status(404).json({ success: false, message: 'Staff account not found' });
  const allowedFields = ['phone', 'displayName', 'role', 'store', 'status', 'dateOfBirth', 'tailorDepartment', 'tailorGrade'];
  const updates = Object.fromEntries(allowedFields
    .filter((field) => Object.prototype.hasOwnProperty.call(requestedUpdates, field))
    .map((field) => [field, requestedUpdates[field] || null]));
  const resultingRole = updates.role || staffUser.role;
  const resultingDepartment = 'tailorDepartment' in updates ? updates.tailorDepartment : staffUser.tailorDepartment;
  if (!updates.displayName && Object.prototype.hasOwnProperty.call(updates, 'displayName')) {
    return res.status(400).json({ success: false, message: 'Staff name is required' });
  }
  if (resultingRole === 'tailor' && !resultingDepartment) {
    return res.status(400).json({ success: false, message: 'A department is required for tailor accounts' });
  }
  if (resultingRole !== 'tailor') {
    updates.tailorDepartment = null;
    updates.tailorGrade = null;
  }
  if (pin) updates.pinHash = await bcrypt.hash(pin, 12);

  await staffUser.update(updates);
  res.json({ success: true, data: { staffUser } });
}));

router.delete('/staff/:id', asyncHandler(async (req, res) => {
  const { ownerPhone, ownerPin } = req.body;
  const owner = await verifiedStaffForProfile(ownerPhone, ownerPin);
  if (!owner || owner.role !== 'owner') {
    return res.status(403).json({ success: false, message: 'Only the Owner can delete staff accounts' });
  }
  const staffUser = await StaffUser.findByPk(req.params.id);
  if (!staffUser) return res.status(404).json({ success: false, message: 'Staff account not found' });
  if (staffUser.id === owner.id) {
    return res.status(400).json({ success: false, message: 'The Owner cannot delete their own account' });
  }
  await staffUser.destroy();
  res.json({ success: true, message: 'Staff account deleted' });
}));

router.post('/staff/:phone/profile-image', profileImageUpload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Select an image to upload' });
  }
  const staffUser = await verifiedStaffForProfile(req.params.phone, req.body.pin);
  if (!staffUser) {
    return res.status(403).json({ success: false, message: 'Unable to verify this staff account' });
  }

  const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  const uploaded = await cloudinaryService.uploadAvatar(dataUri);
  await staffUser.update({ profileImageUrl: uploaded.secure_url });
  res.json({
    success: true,
    data: {
      profileImageUrl: staffUser.profileImageUrl,
    },
  });
}));

router.delete('/staff/:phone/profile-image', asyncHandler(async (req, res) => {
  const staffUser = await StaffUser.findOne({ where: { phone: req.params.phone } });
  if (!staffUser) {
    return res.status(404).json({ success: false, message: 'Staff account not found' });
  }
  if (!req.body.pin || !(await bcrypt.compare(req.body.pin, staffUser.pinHash))) {
    return res.status(403).json({ success: false, message: 'Unable to verify this staff account' });
  }
  await staffUser.update({ profileImageUrl: null });
  res.json({ success: true, data: { profileImageUrl: null } });
}));

router.patch('/staff/:id/tailor-grade', asyncHandler(async (req, res) => {
  const { grade, ownerPhone, ownerPin } = req.body;
  const numericGrade = Number(grade);
  if (!Number.isInteger(numericGrade) || numericGrade < 1 || numericGrade > 5) {
    return res.status(400).json({ success: false, message: 'Tailor grade must be a whole number from 1 to 5' });
  }

  const owner = await verifiedStaffForProfile(ownerPhone, ownerPin);
  if (!owner || owner.role !== 'owner') {
    return res.status(403).json({ success: false, message: 'Only the Owner can update tailor grades' });
  }

  const tailor = await StaffUser.findOne({ where: { id: req.params.id, role: 'tailor' } });
  if (!tailor) {
    return res.status(404).json({ success: false, message: 'Tailor account not found' });
  }
  await tailor.update({ tailorGrade: numericGrade });
  res.json({
    success: true,
    data: {
      staffUser: {
        id: tailor.id,
        displayName: tailor.displayName,
        tailorDepartment: tailor.tailorDepartment,
        tailorGrade: tailor.tailorGrade,
      },
    },
  });
}));

router.post('/customers', asyncHandler(async (req, res) => {
  const { fullName, phone, email, category = 'New', measurements = {} } = req.body;

  if (!fullName || !phone) {
    return res.status(400).json({
      success: false,
      message: 'fullName and phone are required',
    });
  }

  const customer = await Customer.create({
    fullName,
    phone,
    email,
    category,
    measurements,
    portalToken: crypto.randomBytes(32).toString('hex'),
  });

  res.status(201).json({ success: true, data: { customer } });
}));

router.get('/customers', asyncHandler(async (req, res) => {
  const [customerRecords, sentInvoices] = await Promise.all([
    Customer.findAll({ order: [['createdAt', 'DESC']] }),
    SentInvoice.findAll({ order: [['createdAt', 'DESC']], limit: 500 }),
  ]);
  const profiles = [];
  const phoneIndex = new Map();
  const emailIndex = new Map();

  customerRecords.forEach((customer) => {
    const profile = {
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone || '',
      email: customer.email || '',
      category: customer.category || 'New',
      storeCreditBalance: Number(customer.storeCreditBalance || 0),
      measurementsAdded: Boolean(customer.measurements && Object.keys(customer.measurements).length),
      createdAt: customer.createdAt,
      invoices: [],
    };
    profiles.push(profile);
    const phone = String(customer.phone || '').replace(/\D/g, '');
    const email = String(customer.email || '').trim().toLowerCase();
    if (phone) phoneIndex.set(phone, profile);
    if (email) emailIndex.set(email, profile);
  });

  sentInvoices.forEach((invoice) => {
    const phone = String(invoice.customerPhone || '').replace(/\D/g, '');
    const email = String(invoice.customerEmail || '').trim().toLowerCase();
    let profile = (phone && phoneIndex.get(phone)) || (email && emailIndex.get(email));

    if (!profile) {
      profile = {
        id: `sent-${invoice.id}`,
        fullName: invoice.customerName,
        phone: invoice.customerPhone || '',
        email: invoice.customerEmail || '',
        category: 'New',
        storeCreditBalance: 0,
        measurementsAdded: Boolean(invoice.payload?.orderSheet?.measurements),
        createdAt: invoice.createdAt,
        invoices: [],
      };
      profiles.push(profile);
      if (phone) phoneIndex.set(phone, profile);
      if (email) emailIndex.set(email, profile);
    }

    profile.invoices.push(invoice);
    if (!profile.phone && invoice.customerPhone) profile.phone = invoice.customerPhone;
    if (!profile.email && invoice.customerEmail) profile.email = invoice.customerEmail;
    if (!profile.measurementsAdded && invoice.payload?.orderSheet?.measurements) profile.measurementsAdded = true;
  });

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const customers = profiles.map((profile) => {
    const recentInvoices = profile.invoices.filter((invoice) => new Date(invoice.createdAt) >= twelveMonthsAgo);
    const lastInvoice = profile.invoices[0];
    return {
      id: profile.id,
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      category: profile.category === 'New' && profile.invoices.length > 1 ? 'Returning' : profile.category,
      storeCreditBalance: profile.storeCreditBalance,
      measurementsAdded: profile.measurementsAdded,
      totalOrders: profile.invoices.length,
      confirmedOrders: profile.invoices.filter((invoice) => Boolean(invoice.payload?.orderSheet)).length,
      twelveMonthSpend: recentInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
      lifetimeSpend: profile.invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
      lastOrderAt: lastInvoice?.createdAt || null,
      stores: [...new Set(profile.invoices.map((invoice) => invoice.store === 'ikeja' ? 'Ikeja' : 'Lekki'))],
      createdAt: profile.createdAt,
    };
  }).sort((first, second) => new Date(second.lastOrderAt || second.createdAt) - new Date(first.lastOrderAt || first.createdAt));

  res.json({ success: true, data: { customers } });
}));

router.post('/invoices', asyncHandler(async (req, res) => {
  const {
    customerId,
    createdById,
    store,
    subtotal = 0,
    discountAmount = 0,
    storeCreditApplied = 0,
  } = req.body;

  if (!customerId || !createdById || !store) {
    return res.status(400).json({
      success: false,
      message: 'customerId, createdById, and store are required',
    });
  }

  const totalAmount = Number(subtotal) - Number(discountAmount) - Number(storeCreditApplied);
  const invoice = await Invoice.create({
    customerId,
    createdById,
    store,
    subtotal,
    discountAmount,
    storeCreditApplied,
    totalAmount: Math.max(totalAmount, 0),
    invoiceNumber: invoiceNumber(),
  });

  res.status(201).json({ success: true, data: { invoice } });
}));

router.post('/invoices/html-preview', (req, res) => {
  const payload = buildInvoiceHtmlPayload({
    ...req.body,
    invoiceNumber: req.body.invoiceNumber || 'INV22013',
    invoiceDate: req.body.invoiceDate || '2026-04-16',
    dueDate: req.body.dueDate || '2026-04-16',
    customer: req.body.customer || { name: 'Mr Akpan', phone: '+1 (850) 450-7944' },
    items: req.body.items || [
      {
        description: 'Black Double Breasted Three Piece Suit',
        rate: 400000,
        quantity: 1,
        amount: 400000,
      },
      {
        description: 'Light Brown Double Breasted Three Piece Suit',
        rate: 400000,
        quantity: 1,
        amount: 400000,
      },
      {
        description: 'Lapel Pin',
        note: 'Complimentary with order.',
        rate: 20000,
        quantity: 2,
        discountPercent: 100,
        amount: 0,
      },
    ],
    subtotal: req.body.subtotal ?? 800000,
    eliteDiscountAmount: req.body.eliteDiscountAmount ?? 40000,
    balanceDue: req.body.balanceDue ?? 760000,
    trackingUrl: req.body.trackingUrl || 'https://track.twiflagos.com/c/a8f3d2e19b',
  });

  const html = createTwifInvoiceHtml(payload);
  res.type('html').send(html);
});

router.get('/invoices/sent', asyncHandler(async (req, res) => {
  const invoices = await SentInvoice.findAll({
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  res.json({
    success: true,
    data: {
      invoices: invoices.map(formatSentInvoice),
    },
  });
}));

router.post('/invoices/send-email', asyncHandler(async (req, res) => {
  const { recipientEmail } = req.body;

  if (!recipientEmail) {
    return res.status(400).json({
      success: false,
      message: 'recipientEmail is required',
    });
  }

  const payload = buildInvoiceHtmlPayload(req.body);
  if (!payload.customer?.name && !payload.customer?.fullName) {
    return res.status(400).json({
      success: false,
      message: 'customer.name is required',
    });
  }

  if (!payload.items.length) {
    return res.status(400).json({
      success: false,
      message: 'At least one invoice item is required',
    });
  }

  const html = createTwifInvoiceHtml(payload);
  const invoiceRecord = {
    invoiceNumber: payload.invoiceNumber,
    store: payload.store === 'ikeja' ? 'ikeja' : 'lekki',
    customerName: payload.customer.name || payload.customer.fullName,
    customerEmail: recipientEmail,
    customerPhone: payload.customer.phone || null,
    createdByName: req.body.createdByName || 'Store Manager',
    total: Number(payload.balanceDue || 0),
    paymentStatus: payload.paymentStatus === 'fully_paid' ? 'fully_paid' : 'partial_paid',
    emailStatus: 'failed',
    orderStatus: paymentStatusLabel(payload.paymentStatus),
    payload: {
      ...payload,
      recipientEmail,
      accountApprovalStatus: 'Pending Accounts',
    },
  };

  // Persist the invoice and customer identity before contacting the email
  // provider. A delivery failure must not make the customer disappear.
  const existingInvoice = await SentInvoice.findOne({ where: { invoiceNumber: payload.invoiceNumber } });
  await SentInvoice.upsert(invoiceRecord);
  if (!existingInvoice) {
    await notifyRoles(
      ['accounts'],
      `${payload.invoiceNumber} for ${invoiceRecord.customerName} is waiting for Accounts review.`,
      { invoiceNumber: payload.invoiceNumber, event: 'invoice_created' }
    );
  }

  const result = await sendEmail({
    to: recipientEmail,
    subject: `Invoice ${payload.invoiceNumber} from The Way It Fits`,
    html,
    text: plainTextInvoice(payload),
  });

  if (!result.success) {
    return res.status(502).json({
      success: false,
      message: 'Invoice saved, but the email could not be sent',
      error: result.error,
    });
  }

  await SentInvoice.upsert({
    ...invoiceRecord,
    emailStatus: 'sent',
    messageId: result.messageId,
  });

  const sentInvoice = await SentInvoice.findOne({
    where: { invoiceNumber: payload.invoiceNumber },
  });

  return res.json({
    success: true,
    message: 'Invoice email sent',
    data: {
      invoiceNumber: payload.invoiceNumber,
      recipientEmail,
      messageId: result.messageId,
      sentInvoice: formatSentInvoice(sentInvoice),
    },
  });
}));

router.patch('/invoices/:invoiceNumber/account-approval', asyncHandler(async (req, res) => {
  const { status = 'Approved', note = '' } = req.body;
  const invoice = await SentInvoice.findOne({
    where: { invoiceNumber: req.params.invoiceNumber },
  });

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found',
    });
  }

  const payload = invoice.payload || {};
  const accountApprovalStatus = status === 'Flagged' ? 'Flagged' : 'Approved';

  await invoice.update({
    payload: {
      ...payload,
      accountApprovalStatus,
      accountApprovalNote: note,
      accountApprovedAt: accountApprovalStatus === 'Approved' ? new Date().toISOString() : null,
    },
  });

  const refreshedInvoice = await SentInvoice.findOne({
    where: { invoiceNumber: req.params.invoiceNumber },
  });

  await notifyRoles(
    ['store_manager'],
    `${invoice.invoiceNumber} was ${accountApprovalStatus.toLowerCase()} by Accounts.`,
    { invoiceNumber: invoice.invoiceNumber, event: 'account_approval' }
  );
  if (accountApprovalStatus === 'Approved' && payload.orderSheet) {
    await notifyRoles(
      ['production_manager'],
      `${invoice.invoiceNumber} for ${invoice.customerName} is approved and ready for Production.`,
      { invoiceNumber: invoice.invoiceNumber, event: 'production_ready' }
    );
  }

  res.json({
    success: true,
    data: {
      invoice: formatSentInvoice(refreshedInvoice),
    },
  });
}));

router.get('/track/:token', asyncHandler(async (req, res) => {
  const invoice = await findSentInvoiceByTrackingToken(req.params.token);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Tracking link not found',
    });
  }

  const payload = invoice.payload || {};
  const firstItem = Array.isArray(payload.items) ? payload.items[0] : null;
  const orderSheet = payload.orderSheet || {};

  res.json({
    success: true,
    data: {
      tracking: {
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customerName,
        store: invoice.store === 'ikeja' ? 'Ikeja' : 'Lekki',
        item: orderSheet.item || firstItem?.description || '',
        pieces: Number(orderSheet.pieces || firstItem?.quantity || 1),
        deliveryDate: orderSheet.delivery || payload.dueDate || '',
        status: customerTrackingStatus(orderSheet.status),
        fabric: orderSheet.fabric || '',
        measurementsAdded: Boolean(orderSheet.measurements),
        designNotesAdded: Boolean(orderSheet.designNotes),
        styleImagesCount: Array.isArray(orderSheet.styleImages) ? orderSheet.styleImages.length : 0,
        lastUpdatedAt: orderSheet.updatedAt || invoice.updatedAt,
      },
    },
  });
}));

router.get('/track/:token/profile', asyncHandler(async (req, res) => {
  const sourceInvoice = await findSentInvoiceByTrackingToken(req.params.token);

  if (!sourceInvoice) {
    return res.status(404).json({
      success: false,
      message: 'Customer link not found',
    });
  }

  const invoices = await invoicesForCustomer(sourceInvoice);
  const invoiceHistory = invoices.map((invoice) => {
    const payload = invoice.payload || {};
    const items = Array.isArray(payload.items) ? payload.items : [];

    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: payload.invoiceDate || invoice.createdAt,
      store: invoice.store === 'ikeja' ? 'Ikeja' : 'Lekki',
      total: Number(invoice.total || 0),
      balanceDue: Number(payload.balanceDue || 0),
      paymentStatus: paymentStatusLabel(invoice.paymentStatus),
      orderStatus: customerTrackingStatus(payload.orderSheet?.status || invoice.orderStatus),
      items: items.map((item) => ({
        description: item.description || item.name || 'Custom order',
        quantity: Number(item.quantity || 1),
      })),
    };
  });

  res.json({
    success: true,
    data: {
      profile: {
        name: sourceInvoice.customerName,
        phone: sourceInvoice.customerPhone || '',
        email: sourceInvoice.customerEmail || '',
        totalOrders: invoiceHistory.length,
        totalSpend: invoiceHistory.reduce((sum, invoice) => sum + invoice.total, 0),
        invoices: invoiceHistory,
      },
    },
  });
}));

router.post('/tracking/order-sheet', asyncHandler(async (req, res) => {
  const { trackingToken: token, invoiceNumber: sentInvoiceNumber, orderSheet = {} } = req.body;
  const invoice = token
    ? await findSentInvoiceByTrackingToken(token)
    : await SentInvoice.findOne({ where: { invoiceNumber: sentInvoiceNumber } });

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice tracking record not found',
    });
  }

  const payload = invoice.payload || {};
  const resolvedToken = payload.trackingToken || token || trackingTokenFromUrl(payload.trackingUrl) || trackingToken();
  const nextPayload = {
    ...payload,
    trackingToken: resolvedToken,
    trackingUrl: payload.trackingUrl || trackingUrlForToken(resolvedToken),
    orderSheet: {
      ...(payload.orderSheet || {}),
      ...orderSheet,
      status: orderSheet.status || payload.orderSheet?.status || 'Order Sheet Confirmed',
      updatedAt: new Date().toISOString(),
    },
  };

  await invoice.update({
    payload: nextPayload,
    orderStatus: customerTrackingStatus(nextPayload.orderSheet.status),
  });

  await notifyRoles(
    ['accounts'],
    `${invoice.invoiceNumber} has a new order sheet and is waiting for Accounts approval.`,
    { invoiceNumber: invoice.invoiceNumber, event: 'order_sheet_created' }
  );
  await notifyRoles(
    ['production_manager'],
    `A new order sheet was released for ${invoice.customerName} (${invoice.invoiceNumber}).`,
    { invoiceNumber: invoice.invoiceNumber, event: 'order_sheet_released' }
  );

  res.json({
    success: true,
    data: {
      tracking: {
        trackingToken: resolvedToken,
        trackingUrl: nextPayload.trackingUrl,
        status: customerTrackingStatus(nextPayload.orderSheet.status),
      },
    },
  });
}));

router.patch('/tracking/order-sheet/:token', asyncHandler(async (req, res) => {
  const invoice = await findSentInvoiceByTrackingToken(req.params.token);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice tracking record not found',
    });
  }

  const payload = invoice.payload || {};
  const previousOrderSheet = payload.orderSheet || {};
  const nextOrderSheet = {
    ...previousOrderSheet,
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  await invoice.update({
    payload: {
      ...payload,
      orderSheet: nextOrderSheet,
    },
    orderStatus: customerTrackingStatus(nextOrderSheet.status || invoice.orderStatus),
  });

  if (nextOrderSheet.tailor && nextOrderSheet.tailor !== 'Unassigned' && nextOrderSheet.tailor !== previousOrderSheet.tailor) {
    await notifyRoles(
      ['tailor'],
      `You were assigned ${nextOrderSheet.item || 'an order'} for ${invoice.customerName} (${invoice.invoiceNumber}).`,
      { invoiceNumber: invoice.invoiceNumber, tailorName: nextOrderSheet.tailor, event: 'tailor_assigned' }
    );
  }
  const nextIsReady = ['Ready', 'Ready for Collection'].includes(nextOrderSheet.status);
  const previousWasReady = ['Ready', 'Ready for Collection'].includes(previousOrderSheet.status);
  if (nextIsReady && !previousWasReady) {
    await notifyRoles(
      ['store_manager', 'owner', 'admin'],
      `${invoice.invoiceNumber} for ${invoice.customerName} was marked ready.`,
      { invoiceNumber: invoice.invoiceNumber, event: 'order_ready' }
    );
  }

  res.json({
    success: true,
    data: {
      tracking: {
        trackingToken: req.params.token,
        trackingUrl: payload.trackingUrl || trackingUrlForToken(req.params.token),
        status: customerTrackingStatus(nextOrderSheet.status),
      },
    },
  });
}));

router.post('/order-sheets', asyncHandler(async (req, res) => {
  const {
    invoiceId,
    items,
    pieces = 1,
    deliveryDate,
    measurementsSnapshot = {},
    fabricSource = 'inventory',
    fabricName,
    styleImages = [],
    designNotes,
    styleNotes,
  } = req.body;

  if (!invoiceId || !items || !deliveryDate) {
    return res.status(400).json({
      success: false,
      message: 'invoiceId, items, and deliveryDate are required',
    });
  }

  const orderSheet = await OrderSheet.create({
    invoiceId,
    items,
    pieces,
    deliveryDate,
    measurementsSnapshot,
    fabricSource,
    fabricName,
    styleImages,
    designNotes,
    styleNotes,
    status: 'pending_payment',
  });

  res.status(201).json({ success: true, data: { orderSheet } });
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const orders = await OrderSheet.findAll({
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: Invoice,
        as: 'invoice',
        include: [{ model: Customer, as: 'customer' }],
      },
      { model: StaffUser, as: 'assignedTailor', attributes: ['id', 'displayName', 'role'] },
    ],
  });

  res.json({ success: true, data: { orders } });
}));

router.post('/fabrics', asyncHandler(async (req, res) => {
  const { name, type, quantity = 0, unit = 'm', supplier, lowStockThreshold = 0 } = req.body;
  const numericQuantity = Number(quantity);
  const numericThreshold = Number(lowStockThreshold);

  if (!String(name || '').trim() || !String(type || '').trim() || !String(unit || '').trim()) {
    return res.status(400).json({
      success: false,
      message: 'name, type, and unit are required',
    });
  }
  if (!inventoryCategories.has(String(type).trim())) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid inventory category',
    });
  }
  if (!Number.isFinite(numericQuantity) || !Number.isFinite(numericThreshold)
    || numericQuantity < 0 || numericThreshold < 0) {
    return res.status(400).json({
      success: false,
      message: 'Quantity and low-stock threshold must be valid non-negative numbers',
    });
  }

  const fabric = await Fabric.create({
    name: String(name).trim(),
    type: String(type).trim(),
    quantity: numericQuantity,
    unit: String(unit).trim(),
    supplier: String(supplier || '').trim() || null,
    lowStockThreshold: numericThreshold,
  });
  await notifyRoles(
    ['accounts'],
    `${fabric.name} was added to inventory: ${Number(fabric.quantity)} ${fabric.unit}.`,
    { fabricId: fabric.id, event: 'inventory_created' }
  );
  res.status(201).json({ success: true, data: { fabric } });
}));

router.get('/fabrics', asyncHandler(async (req, res) => {
  const fabrics = await Fabric.findAll({ order: [['name', 'ASC']] });
  res.json({ success: true, data: { fabrics } });
}));

router.post('/fabrics/allocate', asyncHandler(async (req, res) => {
  const { fabricId, quantity, trackingToken: token, tailorName } = req.body;
  const amount = Number(quantity);

  if (!fabricId || !token || !tailorName || tailorName === 'Unassigned' || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Fabric, assigned tailor, order sheet, and a positive usage quantity are required' });
  }

  const sourceInvoice = await findSentInvoiceByTrackingToken(token);
  if (!sourceInvoice) {
    return res.status(404).json({ success: false, message: 'Production order sheet not found' });
  }

  let allocationResult;
  await db.sequelize.transaction(async (transaction) => {
    const [fabric, invoice] = await Promise.all([
      Fabric.findByPk(fabricId, { transaction, lock: transaction.LOCK.UPDATE }),
      SentInvoice.findByPk(sourceInvoice.id, { transaction, lock: transaction.LOCK.UPDATE }),
    ]);

    if (!fabric) {
      const error = new Error('Inventory item not found');
      error.status = 404;
      throw error;
    }

    const payload = invoice.payload || {};
    const orderSheet = payload.orderSheet || {};
    if (orderSheet.fabricAllocated) {
      const error = new Error('Fabric has already been allocated to this order');
      error.status = 409;
      throw error;
    }

    const available = Number(fabric.quantity || 0);
    if (amount > available) {
      const error = new Error(`Only ${available} ${fabric.unit} of ${fabric.name} is available`);
      error.status = 400;
      throw error;
    }

    const remaining = available - amount;
    await fabric.update({ quantity: remaining }, { transaction });
    const nextOrderSheet = {
      ...orderSheet,
      fabric: fabric.name,
      fabricId: fabric.id,
      fabricUsage: amount,
      fabricUnit: fabric.unit,
      fabricAllocated: true,
      fabricAllocatedAt: new Date().toISOString(),
      tailor: tailorName,
    };
    await invoice.update({ payload: { ...payload, orderSheet: nextOrderSheet } }, { transaction });
    await InventoryAllocation.create({
      fabricId: fabric.id,
      fabricName: fabric.name,
      quantity: amount,
      unit: fabric.unit,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      tailorName,
      trackingToken: token,
    }, { transaction });

    allocationResult = { fabric, orderSheet: nextOrderSheet, reachedThreshold: remaining <= Number(fabric.lowStockThreshold || 0) };
  });

  if (allocationResult.reachedThreshold) {
    await notifyRoles(
      ['owner', 'admin'],
      `${allocationResult.fabric.name} is at or below its low-stock threshold (${Number(allocationResult.fabric.quantity)} ${allocationResult.fabric.unit} remaining).`,
      { fabricId: allocationResult.fabric.id, event: 'low_stock' }
    );
  }

  await notifyRoles(
    ['inventory_manager'],
    `${Number(allocationResult.orderSheet.fabricUsage)} ${allocationResult.fabric.unit} of ${allocationResult.fabric.name} was allocated to ${sourceInvoice.invoiceNumber}.`,
    { fabricId: allocationResult.fabric.id, invoiceNumber: sourceInvoice.invoiceNumber, event: 'fabric_allocated' }
  );

  res.json({ success: true, data: allocationResult });
}));

router.get('/notifications', asyncHandler(async (req, res) => {
  const role = String(req.query.role || '');
  const displayName = String(req.query.name || '').trim();
  if (!role) return res.status(400).json({ success: false, message: 'role is required' });
  let items = await OmsNotification.findAll({
    where: { recipientRole: role },
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  if (role === 'tailor' && displayName) {
    items = items.filter((item) => !item.metadata?.tailorName || item.metadata.tailorName === displayName);
  }
  res.json({
    success: true,
    data: {
      notifications: items,
      unreadCount: items.filter((item) => !item.isRead).length,
    },
  });
}));

router.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  const role = String(req.body.role || '');
  const displayName = String(req.body.name || '').trim();
  if (!role) return res.status(400).json({ success: false, message: 'role is required' });

  let items = await OmsNotification.findAll({ where: { recipientRole: role, isRead: false } });
  if (role === 'tailor' && displayName) {
    items = items.filter((item) => !item.metadata?.tailorName || item.metadata.tailorName === displayName);
  }
  await OmsNotification.update(
    { isRead: true },
    { where: { id: items.map((item) => item.id) } }
  );
  res.json({ success: true, data: { updated: items.length } });
}));

router.get('/fabrics/allocations', asyncHandler(async (req, res) => {
  const allocations = await InventoryAllocation.findAll({
    order: [['createdAt', 'DESC']],
    limit: 250,
  });
  res.json({ success: true, data: { allocations } });
}));

router.get('/reports/end-of-period', asyncHandler(async (req, res) => {
  const endDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();
  const startDate = req.query.from
    ? new Date(`${req.query.from}T00:00:00.000Z`)
    : new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return res.status(400).json({ success: false, message: 'Select a valid report date range' });
  }

  const periodWhere = { createdAt: { [db.Sequelize.Op.between]: [startDate, endDate] } };
  const [invoices, allocations, inventory, staffUsers] = await Promise.all([
    SentInvoice.findAll({ where: periodWhere, order: [['createdAt', 'DESC']] }),
    InventoryAllocation.findAll({ where: periodWhere, order: [['createdAt', 'DESC']] }),
    Fabric.findAll({ order: [['name', 'ASC']] }),
    StaffUser.findAll({ attributes: ['id', 'role', 'status', 'createdAt'] }),
  ]);

  const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const fullyPaid = invoices.filter((invoice) => invoice.paymentStatus === 'fully_paid');
  const partiallyPaid = invoices.filter((invoice) => invoice.paymentStatus === 'partial_paid');
  const approved = invoices.filter((invoice) => invoice.payload?.accountApprovalStatus === 'Approved');
  const readyOrders = invoices.filter((invoice) => ['Ready', 'Ready for Collection'].includes(invoice.payload?.orderSheet?.status));
  const activeOrders = invoices.filter((invoice) => invoice.payload?.orderSheet && !['Ready', 'Ready for Collection'].includes(invoice.payload.orderSheet.status));
  const uniqueCustomers = new Set(invoices.map((invoice) => {
    const email = String(invoice.customerEmail || '').trim().toLowerCase();
    const phone = String(invoice.customerPhone || '').replace(/\D/g, '');
    return email || phone || invoice.customerName.toLowerCase();
  }));
  const storeBreakdown = ['lekki', 'ikeja'].map((store) => {
    const storeInvoices = invoices.filter((invoice) => invoice.store === store);
    return {
      store: store === 'lekki' ? 'Lekki' : 'Ikeja',
      invoices: storeInvoices.length,
      total: storeInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
    };
  });

  res.json({
    success: true,
    data: {
      report: {
        period: { from: startDate.toISOString(), to: endDate.toISOString() },
        summary: {
          invoiceCount: invoices.length,
          totalInvoiced,
          fullyPaidCount: fullyPaid.length,
          partiallyPaidCount: partiallyPaid.length,
          approvedCount: approved.length,
          pendingApprovalCount: invoices.length - approved.length,
          activeOrderCount: activeOrders.length,
          readyOrderCount: readyOrders.length,
          customerCount: uniqueCustomers.size,
          allocationCount: allocations.length,
          inventoryItemCount: inventory.length,
          lowStockCount: inventory.filter((item) => Number(item.quantity) <= Number(item.lowStockThreshold)).length,
          activeStaffCount: staffUsers.filter((person) => person.status === 'active').length,
          staffAddedCount: staffUsers.filter((person) => person.createdAt >= startDate && person.createdAt <= endDate).length,
        },
        storeBreakdown,
        invoices: invoices.map((invoice) => ({
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.createdAt,
          customer: invoice.customerName,
          store: invoice.store === 'lekki' ? 'Lekki' : 'Ikeja',
          total: Number(invoice.total || 0),
          paymentStatus: paymentStatusLabel(invoice.paymentStatus),
          approvalStatus: invoice.payload?.accountApprovalStatus || 'Pending Accounts',
          orderStatus: invoice.payload?.orderSheet?.status || invoice.orderStatus,
        })),
        allocations: allocations.map((allocation) => ({
          date: allocation.createdAt,
          fabricName: allocation.fabricName,
          quantity: Number(allocation.quantity),
          unit: allocation.unit,
          invoiceNumber: allocation.invoiceNumber,
          customerName: allocation.customerName,
          tailorName: allocation.tailorName,
        })),
      },
    },
  });
}));

router.patch('/fabrics/:id', asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: 'Inventory records cannot be edited. Stock changes must come from production allocation.' });
}));

router.delete('/fabrics/:id', asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: 'Inventory records cannot be deleted.' });
}));

module.exports = router;
