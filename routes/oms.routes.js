const express = require('express');
const crypto = require('crypto');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../models');
const { createTwifInvoiceHtml, getTwifStoreDetails } = require('../utils/twifInvoiceTemplate');
const { sendEmail } = require('../services/email.service');
const cloudinaryService = require('../services/cloudinary.service');

const { signStaffToken, requireStaff, requireRole } = require('../middleware/staffAuth');

const router = express.Router();
const { StaffUser, Customer, Invoice, OrderSheet, Fabric, SentInvoice, OmsNotification, InventoryAllocation, InventoryEditRequest, JobComment, StaffLoginEvent } = db;

// The channel drives the category filter in the notification inbox, so it is
// derived from the event rather than hardcoded.
const CHANNEL_BY_EVENT = {
  invoice_created: 'Invoices',
  account_approval: 'Invoices',
  order_sheet_created: 'Orders',
  order_sheet_released: 'Orders',
  tailor_assigned: 'Production',
  order_ready: 'Production',
  production_ready: 'Production',
  inventory_created: 'Inventory',
  inventory_edit_requested: 'Inventory',
  inventory_edit_approved: 'Inventory',
  inventory_edit_rejected: 'Inventory',
  fabric_allocated: 'Inventory',
  job_comment: 'Production',
  payment_recorded: 'Payments',
  low_stock: 'Inventory',
  customer_updated: 'System',
  customer_archived: 'System',
};

// A short headline per event. Without one the inbox fell back to slicing the
// message at its first full stop, which produced a title identical to the
// message on every row.
const TITLE_BY_EVENT = {
  invoice_created: 'Invoice awaiting Accounts review',
  account_approval: 'Accounts reviewed an invoice',
  order_sheet_created: 'Order sheet submitted',
  order_sheet_released: 'Order sheet released to Production',
  tailor_assigned: 'Job assigned to a tailor',
  order_ready: 'Order marked ready',
  production_ready: 'Approved and ready for Production',
  inventory_created: 'New stock received',
  inventory_edit_requested: 'Inventory edit needs approval',
  inventory_edit_approved: 'Inventory edit approved',
  inventory_edit_rejected: 'Inventory edit rejected',
  fabric_allocated: 'Fabric allocated to a job',
  job_comment: 'New comment on a job',
  payment_recorded: 'Payment recorded',
  low_stock: 'Low stock threshold reached',
  customer_updated: 'Customer profile updated',
  customer_archived: 'Customer profile archived',
};

const notifyRoles = (roles, message, metadata = {}) => Promise.all(
  roles.map((recipientRole) => OmsNotification.create({
    recipientRole,
    channel: CHANNEL_BY_EVENT[metadata.event] || 'System',
    message,
    metadata: { title: TITLE_BY_EVENT[metadata.event] || 'Notification', ...metadata },
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

// Everything in the OMS is staff-only, with three deliberate exceptions:
// signing in, the customer's own tracking link and profile, and the inventory
// item photographs, which are loaded straight into an <img> and so cannot carry
// an Authorization header. The photographs are pictures of cloth and boxes —
// the least sensitive thing here — but the exception is written down rather
// than left to be discovered.
const PUBLIC_PATHS = [
  /^\/auth\/login$/,
  /^\/track\//,
  /^\/fabrics\/[^/]+\/image$/,
];

router.use((req, res, next) => {
  if (PUBLIC_PATHS.some((pattern) => pattern.test(req.path))) return next();
  return requireStaff(req, res, next);
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

const naira = (amount) => Number(amount || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

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

// Signing in. The PIN was checked in the browser against a list compiled into
// the JavaScript, so all seven were readable by anyone who opened the bundle.
// It is checked here now, against a bcrypt hash, and the caller gets a token
// the rest of the API requires.
router.post('/auth/login', asyncHandler(async (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  const pin = String(req.body?.pin || '').trim();

  if (!phone || !pin) {
    return res.status(400).json({ success: false, message: 'Enter your phone number and PIN' });
  }

  const staff = await verifiedStaffForProfile(phone, pin);

  // Every attempt is recorded, so an owner can see who signed in and when a
  // number was being guessed at. A failure to write the record must not stop
  // someone signing in.
  const recordAttempt = (outcome, staffUser) => StaffLoginEvent.create({
    staffUserId: staffUser?.id || null,
    phone,
    outcome,
    ipAddress: req.ip || null,
    userAgent: String(req.get('user-agent') || '').slice(0, 400) || null,
  }).catch((error) => console.error('Login event not recorded:', error.message));

  // One message for a wrong number and a wrong PIN, so it cannot be used to
  // find out which numbers are real.
  if (!staff) {
    await recordAttempt('wrong_credentials', null);
    return res.status(401).json({ success: false, message: 'That phone number and PIN do not match' });
  }
  if (staff.status !== 'active') {
    await recordAttempt('inactive_account', staff);
    return res.status(403).json({ success: false, message: 'This account is no longer active' });
  }

  await recordAttempt('success', staff);
  await staff.update({ lastLoginAt: new Date() });

  res.json({
    success: true,
    data: {
      token: signStaffToken(staff),
      staff: {
        id: staff.id,
        phone: staff.phone,
        displayName: staff.displayName,
        role: staff.role,
        store: staff.store,
        profileImageUrl: staff.profileImageUrl,
        tailorDepartment: staff.tailorDepartment,
        tailorGrade: staff.tailorGrade,
      },
    },
  });
}));

// Who the caller is, used to restore a session on reload rather than trusting
// whatever the browser has in local storage.
router.get('/auth/me', asyncHandler(async (req, res) => {
  const staff = req.staff;
  res.json({
    success: true,
    data: {
      staff: {
        id: staff.id,
        phone: staff.phone,
        displayName: staff.displayName,
        role: staff.role,
        store: staff.store,
        profileImageUrl: staff.profileImageUrl,
        tailorDepartment: staff.tailorDepartment,
        tailorGrade: staff.tailorGrade,
      },
    },
  });
}));

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

// The inventory types the shop actually buys. They used to be a fixed list of
// garment names — Suiting, Bridal, Trouser — which described what a fabric was
// for rather than what was on the shelf, and could not be added to without a
// deploy. The list now lives in PlatformSettings and is editable from the app.
const INVENTORY_TYPES_KEY = 'oms.inventoryTypes';
const DEFAULT_INVENTORY_TYPES = [
  'Fabric',
  'Linings',
  'Packaging Materials',
  'Buttons',
  'Sewing Material',
  'Accessories',
];

// Cloth is measured out, everything else is counted.
const INVENTORY_UNITS = ['yards', 'units'];

// Item photos are stored as data URLs and served back from this origin, so the
// type is pinned to real raster images. Anything else — text/html, or an SVG,
// which can carry script — would otherwise run as a page on our own domain.
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const IMAGE_DATA_URL = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/;

const safeImageDataUrl = (value) => {
  if (typeof value !== 'string') return null;
  const match = IMAGE_DATA_URL.exec(value.trim());
  return match && ALLOWED_IMAGE_TYPES.has(match[1].toLowerCase()) ? value.trim() : null;
};

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
    paymentMethod: ['transfer', 'card', 'check', 'cash'].includes(body.paymentMethod) ? body.paymentMethod : 'transfer',
    trackingToken: token,
    trackingUrl: body.trackingUrl || trackingUrlForToken(token),
    notes: body.notes,
    paymentEvidence: body.paymentEvidence || null,
  };
};

const plainTextInvoice = (payload) => {
  const lines = [
    `Invoice ${payload.invoiceNumber}`,
    `Store: ${getTwifStoreDetails(payload.store).label}`,
    `Customer: ${payload.customer?.name || payload.customer?.fullName || 'Customer'}`,
    `Payment status: ${payload.paymentStatus === 'fully_paid' ? 'Fully Paid' : payload.paymentStatus === 'unpaid' ? 'Unpaid' : 'Partial Paid'}`,
    `Payment method: ${payload.paymentMethod.charAt(0).toUpperCase()}${payload.paymentMethod.slice(1)}`,
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

const paymentStatusLabel = (status) => status === 'fully_paid' ? 'Fully Paid' : status === 'unpaid' ? 'Unpaid' : 'Partial Paid';

// Anything that was not Ready reported as In Progress, so a customer saw "In
// Progress" from the moment their invoice was sent — before an order sheet
// existed, before a tailor had been assigned, and before any work had started.
// Production sets a job to In Progress when a tailor begins it; until then the
// order has been received and nothing more.
const customerTrackingStatus = (status) => {
  if (status === 'Ready' || status === 'Ready for Collection') return 'Ready for Collection';
  if (status === 'In Progress') return 'In Progress';
  return 'Order Received';
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
    paymentMethod: payload.paymentMethod
      ? `${payload.paymentMethod.charAt(0).toUpperCase()}${payload.paymentMethod.slice(1)}`
      : 'Transfer',
    orderStatus: invoice.orderStatus || paymentStatusLabel(invoice.paymentStatus),
    accountApprovalStatus: payload.accountApprovalStatus || 'Pending Accounts',
    item: firstItem?.description || '',
    pieces: Number(firstItem?.quantity || 1),
    deliveryDate: payload.dueDate || payload.deliveryDate || '',
    itemNote: firstItem?.note || (Array.isArray(payload.notes) ? payload.notes[0] : '') || '',
    trackingToken: payload.trackingToken || trackingTokenFromUrl(payload.trackingUrl),
    trackingUrl: payload.trackingUrl || (payload.trackingToken ? trackingUrlForToken(payload.trackingToken) : ''),
    orderSheet: payload.orderSheet || null,
    paymentEvidence: payload.paymentEvidence || null,
    // The full document fields, so an invoice can be re-rendered as a PDF or
    // resent from a list without first reopening the create screen.
    email: invoice.customerEmail || '',
    phone: invoice.customerPhone || '',
    items: Array.isArray(payload.items) ? payload.items : [],
    subtotal: Number(payload.subtotal || 0),
    eliteDiscountAmount: Number(payload.eliteDiscountAmount || 0),
    storeCreditApplied: Number(payload.storeCreditApplied || 0),
    balanceDue: Number(payload.balanceDue ?? invoice.total ?? 0),
    paid: payload.paid ?? payload.amountPaid ?? payload.amountReceived ?? payload.paymentAmount ?? null,
    paymentHistory: Array.isArray(payload.paymentHistory) ? payload.paymentHistory : [],
    invoiceDate: payload.invoiceDate || invoice.createdAt,
    dueDate: payload.dueDate || '',
    notes: payload.notes || '',
    storeKey: invoice.store,
    paymentMethodKey: payload.paymentMethod || 'transfer',
    paymentStatusKey: invoice.paymentStatus,
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

router.post('/staff', requireRole('owner'), asyncHandler(async (req, res) => {
  const {
    phone,
    pin,
    displayName,
    role,
    store = 'all',
    dateOfBirth,
    tailorDepartment,
    tailorGrade,
  } = req.body;

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

router.patch('/staff/:id', requireRole('owner'), asyncHandler(async (req, res) => {
  const { pin, ...requestedUpdates } = req.body;

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
  // A PIN that has been reset has usually been reset because it was known to
  // someone else, so every session it opened is ended with it.
  if (pin) {
    if (String(pin).trim().length < 4) {
      return res.status(400).json({ success: false, message: 'A PIN must be at least 4 characters' });
    }
    updates.pinHash = await bcrypt.hash(String(pin).trim(), 12);
    updates.forceLogoutAt = new Date();
  }

  await staffUser.update(updates);
  res.json({ success: true, data: { staffUser } });
}));

// Who has tried to sign in to this account, successfully or not. Restricted to
// the two roles that manage accounts: it names IP addresses and failed tries.
router.get('/staff/:id/logins', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const staffUser = await StaffUser.findByPk(req.params.id);
  if (!staffUser) return res.status(404).json({ success: false, message: 'Staff account not found' });

  // Matched on the phone number as well as the id, so attempts against a number
  // that belongs to nobody yet — or to an account created later — still show.
  const events = await StaffLoginEvent.findAll({
    where: { [Op.or]: [{ staffUserId: staffUser.id }, { phone: staffUser.phone }] },
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  res.json({ success: true, data: { events } });
}));

router.delete('/staff/:id', requireRole('owner'), asyncHandler(async (req, res) => {
  const staffUser = await StaffUser.findByPk(req.params.id);
  if (!staffUser) return res.status(404).json({ success: false, message: 'Staff account not found' });
  if (staffUser.id === req.staff.id) {
    return res.status(400).json({ success: false, message: 'The Owner cannot delete their own account' });
  }
  await staffUser.destroy();
  res.json({ success: true, message: 'Staff account deleted' });
}));

router.post('/staff/:phone/profile-image', profileImageUpload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Select an image to upload' });
  }
  // Was verified by re-sending the PIN, which the app no longer holds, so no
  // photo could be uploaded at all. The token says who is asking: a member of
  // staff changes their own picture, and the Owner may change anyone's.
  const staffUser = await StaffUser.findOne({ where: { phone: req.params.phone } });
  if (!staffUser) return res.status(404).json({ success: false, message: 'Staff account not found' });
  if (staffUser.id !== req.staff.id && req.staff.role !== 'owner') {
    return res.status(403).json({ success: false, message: 'That is not your account' });
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
  if (staffUser && staffUser.id !== req.staff.id && req.staff.role !== 'owner') {
    return res.status(403).json({ success: false, message: 'That is not your account' });
  }
  if (!staffUser) {
    return res.status(404).json({ success: false, message: 'Staff account not found' });
  }
  if (!req.body.pin || !(await bcrypt.compare(req.body.pin, staffUser.pinHash))) {
    return res.status(403).json({ success: false, message: 'Unable to verify this staff account' });
  }
  await staffUser.update({ profileImageUrl: null });
  res.json({ success: true, data: { profileImageUrl: null } });
}));

router.patch('/staff/:id/tailor-grade', requireRole('owner'), asyncHandler(async (req, res) => {
  const { grade } = req.body;
  const numericGrade = Number(grade);
  if (!Number.isInteger(numericGrade) || numericGrade < 1 || numericGrade > 5) {
    return res.status(400).json({ success: false, message: 'Tailor grade must be a whole number from 1 to 5' });
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

// An address differing only by case or by stray spaces is the same inbox, so
// the check is made against a normalised form.
const normalisedEmail = (value) => String(value || '').trim().toLowerCase();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A customer's email is how the invoice and the tracking link reach them, so a
// record without one is of little use — and two customers sharing one address
// cannot be told apart when a reply comes back.
const findCustomerByEmail = async (email, exceptId) => {
  const rows = await Customer.findAll({ attributes: ['id', 'fullName', 'email'] });
  return rows.find((row) => normalisedEmail(row.email) === normalisedEmail(email) && row.id !== exceptId);
};

// Records created before the address was required, or before it had to be
// unique, are reported here rather than deleted — a customer record carries
// measurements and history that should not disappear without someone deciding
// which of the two to keep.
// The report names every customer sharing an address, so it stays with the two
// roles that can act on it rather than with all staff.
router.get('/customers/duplicates', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const customers = await Customer.findAll({ order: [['createdAt', 'ASC']] });

  const byEmail = new Map();
  const missingEmail = [];
  for (const customer of customers) {
    const key = normalisedEmail(customer.email);
    if (!key) { missingEmail.push(customer); continue; }
    byEmail.set(key, [...(byEmail.get(key) || []), customer]);
  }

  const summarise = (customer) => ({
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    category: customer.category,
    createdAt: customer.createdAt,
    hasMeasurements: Object.keys(customer.measurements || {}).some((key) => key !== 'profile'),
  });

  const duplicates = [...byEmail.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([email, rows]) => ({ email, customers: rows.map(summarise) }));

  res.json({
    success: true,
    data: { duplicates, missingEmail: missingEmail.map(summarise) },
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
  if (!normalisedEmail(email)) {
    return res.status(400).json({ success: false, message: 'An email address is required' });
  }
  if (!EMAIL_PATTERN.test(normalisedEmail(email))) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }

  const clash = await findCustomerByEmail(email);
  if (clash) {
    return res.status(409).json({ success: false, message: `${clash.fullName} already uses ${clash.email}` });
  }

  const existingPhone = await Customer.findOne({ where: { phone } });
  if (existingPhone) {
    return res.status(409).json({ success: false, message: `${existingPhone.fullName} already uses ${phone}` });
  }

  const customer = await Customer.create({
    fullName,
    phone,
    email: String(email).trim(),
    category,
    measurements,
    portalToken: crypto.randomBytes(32).toString('hex'),
  });

  res.status(201).json({ success: true, data: { customer } });
}));

router.get('/customers', asyncHandler(async (req, res) => {
  // Archiving used to set the category and nothing else, so the customer came
  // straight back on the next load and the button looked broken.
  const includeArchived = String(req.query.includeArchived || '') === 'true';
  const [customerRecords, sentInvoices] = await Promise.all([
    Customer.findAll({
      where: includeArchived ? {} : { category: { [Op.ne]: 'Archived' } },
      order: [['createdAt', 'DESC']],
    }),
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
      measurementsAdded: Boolean(customer.measurements && Object.keys(customer.measurements).some((key) => key !== 'profile')),
      ...(customer.measurements?.profile || {}),
      measurements: customer.measurements || {},
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
      // Notes, date of birth, occupation, address and the rest of the editable
      // profile are stored under measurements.profile. They were saved but
      // never returned, so every edit looked like it had been lost on reload.
      // `measurements` is stripped from the spread because body measurements
      // live at the top level; an early build nested a copy in here too.
      ...(({ measurements: _nested, ...rest }) => rest)(profile.measurements?.profile || {}),
      id: profile.id,
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      category: profile.category === 'New' && profile.invoices.length > 1 ? 'Returning' : profile.category,
      storeCreditBalance: profile.storeCreditBalance,
      measurementsAdded: profile.measurementsAdded,
      // Body measurements, without the profile block they sit beside.
      measurements: Object.fromEntries(
        Object.entries(profile.measurements || {}).filter(([key]) => key !== 'profile')
      ),
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

router.patch('/customers/:id', asyncHandler(async (req, res) => {
  if (String(req.params.id).startsWith('sent-')) {
    return res.status(409).json({ success: false, message: 'Create a customer profile before editing an invoice-only customer.' });
  }
  const customer = await Customer.findByPk(req.params.id);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  const {
    fullName, phone, email, customerType, category, storeCreditBalance,
    measurements: bodyMeasurements, ...profile
  } = req.body;
  if (!String(fullName || '').trim() || !String(phone || '').trim()) {
    return res.status(400).json({ success: false, message: 'Full name and phone number are required.' });
  }
  if (!normalisedEmail(email)) {
    return res.status(400).json({ success: false, message: 'An email address is required' });
  }
  if (!EMAIL_PATTERN.test(normalisedEmail(email))) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }

  const clash = await findCustomerByEmail(email, customer.id);
  if (clash) {
    return res.status(409).json({ success: false, message: `${clash.fullName} already uses ${clash.email}` });
  }

  const existingMeasurements = customer.measurements || {};

  // Body measurements are stored at the top level, beside the profile block,
  // and blanks are dropped — an empty string is not a measurement, and keeping
  // them made "has measurements" true for a customer nobody had measured.
  const takenMeasurements = bodyMeasurements && typeof bodyMeasurements === 'object'
    ? Object.fromEntries(Object.entries(bodyMeasurements).filter(([, value]) => String(value ?? '').trim()))
    : null;

  // An elite tag turns on an automatic discount on every invoice the customer is
  // sent, so only an Owner or Admin may give or take it away. A store manager
  // saving the profile keeps whatever tier is already there.
  const requestedCategory = customerType || category;
  const isElite = (value) => /elite/i.test(String(value || ''));
  const mayTagElite = ['owner', 'admin'].includes(req.staff?.role);
  if (!mayTagElite && requestedCategory && isElite(requestedCategory) !== isElite(customer.category)) {
    return res.status(403).json({
      success: false,
      message: 'Only an Owner or Admin can change a customer\'s elite membership',
    });
  }

  // The Edit screen's status select is the other way to archive someone, and it
  // only ever wrote to the profile block — so the customer stayed in the list.
  const status = String(profile.status || '').trim();
  const nextCategory = status === 'Archived'
    ? 'Archived'
    : (customer.category === 'Archived' && status && status !== 'Archived'
      ? (customerType || category || 'Returning')
      : (customerType || category || customer.category));

  await customer.update({
    fullName: String(fullName).trim(),
    phone: String(phone).trim(),
    email: String(email).trim(),
    category: nextCategory,
    storeCreditBalance: storeCreditBalance ?? customer.storeCreditBalance,
    measurements: {
      ...existingMeasurements,
      ...(takenMeasurements || {}),
      // Merged, not replaced: a partial save — notes on their own, say — was
      // wiping every other profile field the customer had.
      profile: { ...(existingMeasurements.profile || {}), ...profile },
    },
  });
  await notifyRoles(['owner', 'admin'], `${customer.fullName}'s customer profile was updated.`, { event: 'customer_updated', customerId: customer.id });
  res.json({ success: true, data: { customer } });
}));

router.delete('/customers/:id', asyncHandler(async (req, res) => {
  if (String(req.params.id).startsWith('sent-')) return res.status(409).json({ success: false, message: 'Invoice-only customers cannot be archived.' });
  const customer = await Customer.findByPk(req.params.id);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  const measurements = customer.measurements || {};
  await customer.update({ category: 'Archived', measurements: { ...measurements, profile: { ...(measurements.profile || {}), status: 'Archived' } } });
  await notifyRoles(['owner', 'admin'], `${customer.fullName}'s customer profile was archived.`, { event: 'customer_archived', customerId: customer.id });
  res.json({ success: true, data: { customer } });
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

  // A figure larger than the invoice is a mistake, not a credit.
  const payableTotal = Number(payload.balanceDue || 0);
  const requestedAmount = Number(req.body.amountReceived ?? payload.amountReceived ?? 0);
  if (Number.isFinite(requestedAmount) && requestedAmount > payableTotal) {
    return res.status(400).json({
      success: false,
      message: `That is more than the ${naira(payableTotal)} this invoice comes to`,
    });
  }
  const amountAtCreation = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : 0;

  const html = createTwifInvoiceHtml(payload);
  const invoiceRecord = {
    invoiceNumber: payload.invoiceNumber,
    store: payload.store === 'ikeja' ? 'ikeja' : 'lekki',
    customerName: payload.customer.name || payload.customer.fullName,
    customerEmail: recipientEmail,
    customerPhone: payload.customer.phone || null,
    createdByName: req.body.createdByName || 'Store Manager',
    total: Number(payload.balanceDue || 0),
    paymentStatus: ['unpaid', 'partial_paid', 'fully_paid'].includes(payload.paymentStatus) ? payload.paymentStatus : 'partial_paid',
    emailStatus: 'failed',
    orderStatus: paymentStatusLabel(payload.paymentStatus),
    payload: {
      ...payload,
      recipientEmail,
      accountApprovalStatus: 'Pending Accounts',
      // What the customer handed over as the invoice was raised. It used to be
      // possible to mark an invoice part paid and record no figure at all,
      // which left Accounts nothing to reconcile and production nothing to
      // gate on.
      paid: amountAtCreation,
      ...(amountAtCreation > 0 ? {
        paymentHistory: [{
          amount: amountAtCreation,
          method: payload.paymentMethod || 'Unspecified',
          note: 'Recorded when the invoice was raised',
          recordedBy: req.staff?.displayName || req.body.createdByName || 'Store Manager',
          recordedAt: new Date().toISOString(),
        }],
      } : {}),
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
  if (!['Approved', 'Flagged', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be Approved, Flagged, or Rejected.' });
  }
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
  const accountApprovalStatus = status;

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
    `${invoice.invoiceNumber} for ${invoice.customerName} was ${accountApprovalStatus.toLowerCase()} by Accounts.`,
    {
      invoiceNumber: invoice.invoiceNumber,
      event: 'account_approval',
      title: `Invoice ${accountApprovalStatus.toLowerCase()} by Accounts`,
    }
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

// Recording what a customer actually handed over. An invoice carried a status —
// unpaid, part paid, fully paid — but no figure, so Accounts could not
// reconcile and every screen that wanted an amount had to invent one.
//
// The status follows the money rather than being set by hand: nothing received
// is unpaid, part of it is part paid, all of it is fully paid. That matters
// beyond bookkeeping, because an unpaid order is held out of production.
router.patch('/invoices/:invoiceNumber/payment', requireRole('accounts', 'owner', 'admin'), asyncHandler(async (req, res) => {
  const invoice = await SentInvoice.findOne({ where: { invoiceNumber: req.params.invoiceNumber } });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

  const amount = Number(req.body?.amountReceived);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ success: false, message: 'Enter the amount received as a number' });
  }

  const payload = invoice.payload || {};
  const payable = Math.max(
    0,
    Number(invoice.total || 0) - Number(payload.eliteDiscountAmount || 0) - Number(payload.storeCreditApplied || 0),
  );

  if (amount > payable) {
    return res.status(400).json({
      success: false,
      message: `That is more than the ${naira(payable)} owed on this invoice`,
    });
  }

  const paymentStatus = amount <= 0 ? 'unpaid' : amount >= payable ? 'fully_paid' : 'partial_paid';
  const method = String(req.body?.method || payload.paymentMethod || 'transfer');

  // Each entry is kept, so how a balance was reached can be read back rather
  // than inferred from the total.
  const history = [
    ...(Array.isArray(payload.paymentHistory) ? payload.paymentHistory : []),
    {
      amount,
      method,
      note: String(req.body?.note || '').trim() || null,
      recordedBy: req.staff.displayName,
      recordedAt: new Date().toISOString(),
    },
  ];

  await invoice.update({
    paymentStatus,
    payload: { ...payload, paid: amount, paymentMethod: method, paymentHistory: history },
  });

  const refreshed = await SentInvoice.findOne({ where: { invoiceNumber: req.params.invoiceNumber } });
  await notifyRoles(
    ['store_manager', 'owner'],
    `${req.staff.displayName} recorded ${naira(amount)} against ${invoice.invoiceNumber}.`,
    { invoiceNumber: invoice.invoiceNumber, event: 'payment_recorded' },
  );

  res.json({ success: true, data: { invoice: formatSentInvoice(refreshed) } });
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
  const identity = normalizedCustomerIdentity(sourceInvoice);
  const customerWhere = identity.phone
    ? { phone: sourceInvoice.customerPhone }
    : identity.email ? { email: sourceInvoice.customerEmail } : null;
  const customerRecord = customerWhere ? await Customer.findOne({ where: customerWhere }) : null;
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
      deliveryDate: payload.orderSheet?.delivery || payload.dueDate || null,
      tailor: payload.orderSheet?.tailor || 'To be assigned',
      fabric: payload.orderSheet?.fabric || 'To be confirmed',
      styleImages: Array.isArray(payload.orderSheet?.styleImages) ? payload.orderSheet.styleImages : [],
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
        measurements: customerRecord?.measurements || sourceInvoice.payload?.orderSheet?.measurements || {},
        customerDetails: customerRecord?.measurements?.profile || {},
        storeCreditBalance: Number(customerRecord?.storeCreditBalance || 0),
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
      // Kept from the first save, so lead time is measured from the day the
      // order could have been worked rather than the day the invoice was sent.
      createdAt: payload.orderSheet?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  await invoice.update({
    payload: nextPayload,
    orderStatus: customerTrackingStatus(nextPayload.orderSheet.status),
  });

  await notifyRoles(
    ['owner', 'admin', 'accounts'],
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

// A job may only be worked once Accounts have approved the invoice, the
// customer has paid something, and the garment has measurements. Enforced here
// as well as on screen: a rule that only the interface applies is a suggestion.
const WORKING_STATUSES = ['Assigned', 'In Progress', 'Ready'];

const productionBlockReason = (invoice, orderSheet, releasePercent = 70) => {
  const payload = invoice.payload || {};
  if (payload.accountApprovalStatus !== 'Approved') return 'Accounts have not approved this invoice yet';

  // Approval alone is not enough: enough of the money has to be in. Measured
  // against what was actually recorded as received, not against the label on
  // the invoice, so "part paid" with nothing behind it does not open the gate.
  if (invoice.paymentStatus !== 'fully_paid') {
    const payable = Math.max(0, Number(invoice.total || 0)
      - Number(payload.eliteDiscountAmount || 0)
      - Number(payload.storeCreditApplied || 0));
    const received = Number(payload.paid || 0);
    const percent = payable > 0 ? (received / payable) * 100 : 0;
    if (percent < releasePercent) {
      return received > 0
        ? `Only ${Math.floor(percent)}% of this invoice has been paid — ${releasePercent}% is needed before production can start`
        : `This invoice is unpaid — ${releasePercent}% is needed before production can start`;
    }
  }

  const details = orderSheet.measurementDetails;
  const hasFigures = details && typeof details === 'object'
    && Object.values(details).some((value) => String(value ?? '').trim());
  if (!hasFigures && !String(orderSheet.measurements ?? '').trim()) {
    return 'This order has no measurements, so it cannot go to production';
  }
  return null;
};

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

  // Assigning a tailor, starting work or marking a garment ready are all ways
  // of putting a job into production, so each is refused while the order is
  // held. Everything else about the sheet can still be edited.
  const entersProduction = (WORKING_STATUSES.includes(nextOrderSheet.status)
    && !WORKING_STATUSES.includes(previousOrderSheet.status))
    || (nextOrderSheet.tailor && nextOrderSheet.tailor !== 'Unassigned'
      && nextOrderSheet.tailor !== previousOrderSheet.tailor);

  if (entersProduction) {
    const settings = await readSetting(SETTINGS_KEY, {});
    const releasePercent = Number(settings.paymentReleasePercent ?? DEFAULT_SETTINGS.paymentReleasePercent);
    const blocked = productionBlockReason(invoice, nextOrderSheet, releasePercent);
    if (blocked) {
      // An Owner or Admin may send a held order through anyway, and the
      // override is recorded against the sheet. Accounts may not: approving the
      // invoice is their part, releasing it is not.
      const mayOverride = ['owner', 'admin'].includes(req.staff?.role);
      if (!req.body.overrideProductionHold || !mayOverride) {
        return res.status(409).json({
          success: false,
          message: blocked,
          data: { canOverride: mayOverride },
        });
      }
      nextOrderSheet.productionOverride = {
        reason: blocked,
        by: req.staff.displayName,
        at: new Date().toISOString(),
      };
      await notifyRoles(['owner', 'admin', 'accounts'],
        `${req.staff.displayName} sent ${invoice.invoiceNumber} to production despite: ${blocked}.`,
        { invoiceNumber: invoice.invoiceNumber, event: 'production_override' });
    }
  }
  delete nextOrderSheet.overrideProductionHold;

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
      // The saved sheet comes back, so a caller that released a held order can
      // see the override that was recorded against it.
      orderSheet: nextOrderSheet,
      tracking: {
        trackingToken: req.params.token,
        trackingUrl: payload.trackingUrl || trackingUrlForToken(req.params.token),
        status: customerTrackingStatus(nextOrderSheet.status),
      },
    },
  });
}));

// An order item can be worked by more than one tailor — a suit's jacket and
// trousers are rarely the same pair of hands — so assignment is per item and
// holds a list. The top-level tailor is kept in step with the first of them,
// because the board and the tracking page were built around a single name.
const MAX_TAILORS_PER_ITEM = 4;

const orderSheetOf = (invoice) => (invoice.payload || {}).orderSheet || {};

const saveOrderSheet = async (invoice, orderSheet) => {
  const payload = invoice.payload || {};
  await invoice.update({ payload: { ...payload, orderSheet } });
  return orderSheet;
};

router.patch('/jobs/:invoiceNumber/assignments', requireRole('production_manager', 'owner', 'admin'), asyncHandler(async (req, res) => {
  const invoice = await SentInvoice.findOne({ where: { invoiceNumber: req.params.invoiceNumber } });
  if (!invoice) return res.status(404).json({ success: false, message: 'Order not found' });

  const sheet = orderSheetOf(invoice);
  const items = Array.isArray(sheet.items) && sheet.items.length ? [...sheet.items] : [{ item: sheet.item || '' }];
  const requested = Array.isArray(req.body?.items) ? req.body.items : [];

  for (const entry of requested) {
    const index = Number(entry.index);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      return res.status(400).json({ success: false, message: `There is no item ${index + 1} on this order` });
    }
    const names = [...new Set((entry.tailors || []).map((name) => String(name).trim()).filter(Boolean))];
    if (names.length > MAX_TAILORS_PER_ITEM) {
      return res.status(400).json({
        success: false,
        message: `An item can be shared between at most ${MAX_TAILORS_PER_ITEM} tailors`,
      });
    }
    items[index] = {
      ...items[index],
      tailors: names,
      ...(entry.tailorDueDate !== undefined ? { tailorDueDate: entry.tailorDueDate } : {}),
    };
  }

  // Assigning anyone at all is entering production, so the same gate applies.
  const nowAssigned = items.some((item) => (item.tailors || []).length);
  if (nowAssigned) {
    const settings = await readSetting(SETTINGS_KEY, {});
    const releasePercent = Number(settings.paymentReleasePercent ?? DEFAULT_SETTINGS.paymentReleasePercent);
    const blocked = productionBlockReason(invoice, sheet, releasePercent);
    if (blocked && !sheet.productionOverride) {
      return res.status(409).json({ success: false, message: blocked });
    }
  }

  const everyone = [...new Set(items.flatMap((item) => item.tailors || []))];
  const nextSheet = {
    ...sheet,
    items,
    tailor: everyone[0] || 'Unassigned',
    tailors: everyone,
    status: everyone.length && sheet.status === 'Order Sheet Confirmed' ? 'Assigned' : sheet.status,
    updatedAt: new Date().toISOString(),
  };
  await saveOrderSheet(invoice, nextSheet);

  for (const name of everyone) {
    await notifyRoles(['tailor'],
      `You were assigned work on ${invoice.customerName}'s order (${invoice.invoiceNumber}).`,
      { invoiceNumber: invoice.invoiceNumber, tailorName: name, event: 'tailor_assigned' });
  }

  res.json({ success: true, data: { orderSheet: nextSheet } });
}));

// The production manager marks each tailor's finished work out of ten. The
// score belongs to the tailor and the item, not to the order as a whole.
router.patch('/jobs/:invoiceNumber/scores', requireRole('production_manager', 'owner', 'admin'), asyncHandler(async (req, res) => {
  const invoice = await SentInvoice.findOne({ where: { invoiceNumber: req.params.invoiceNumber } });
  if (!invoice) return res.status(404).json({ success: false, message: 'Order not found' });

  const sheet = orderSheetOf(invoice);
  if (!['Ready', 'Ready for Collection'].includes(sheet.status)) {
    return res.status(409).json({
      success: false,
      message: 'Work can only be scored once it has been marked ready',
    });
  }

  const items = Array.isArray(sheet.items) && sheet.items.length ? [...sheet.items] : [{ item: sheet.item || '' }];
  const requested = Array.isArray(req.body?.scores) ? req.body.scores : [];

  for (const entry of requested) {
    const index = Number(entry.itemIndex);
    const tailor = String(entry.tailor || '').trim();
    const score = Number(entry.score);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      return res.status(400).json({ success: false, message: `There is no item ${index + 1} on this order` });
    }
    if (!tailor) return res.status(400).json({ success: false, message: 'Say which tailor the score is for' });
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      return res.status(400).json({ success: false, message: 'A score runs from 0 to 10' });
    }
    if (!(items[index].tailors || []).includes(tailor)) {
      return res.status(400).json({ success: false, message: `${tailor} did not work on item ${index + 1}` });
    }
    items[index] = {
      ...items[index],
      scores: {
        ...(items[index].scores || {}),
        [tailor]: { score, by: req.staff.displayName, at: new Date().toISOString() },
      },
    };
  }

  const nextSheet = { ...sheet, items, updatedAt: new Date().toISOString() };
  await saveOrderSheet(invoice, nextSheet);
  res.json({ success: true, data: { orderSheet: nextSheet } });
}));

// A job sheet's comment thread. Everyone who touches the job reads and writes
// the same thread, so a question about a garment stays with the garment rather
// than in someone's phone.
router.get('/jobs/:invoiceNumber/comments', asyncHandler(async (req, res) => {
  const comments = await JobComment.findAll({
    where: { invoiceNumber: req.params.invoiceNumber },
    order: [['createdAt', 'ASC']],
  });
  res.json({ success: true, data: { comments } });
}));

router.post('/jobs/:invoiceNumber/comments', asyncHandler(async (req, res) => {
  const { invoiceNumber } = req.params;
  const body = String(req.body?.body || '').trim();
  const authorName = String(req.body?.authorName || '').trim();
  const authorRole = String(req.body?.authorRole || '').trim();

  if (!body) return res.status(400).json({ success: false, message: 'A comment cannot be empty' });
  if (body.length > 2000) return res.status(400).json({ success: false, message: 'That comment is too long' });
  if (!authorName || !authorRole) {
    return res.status(400).json({ success: false, message: 'A comment needs an author' });
  }

  const invoice = await SentInvoice.findOne({ where: { invoiceNumber } });
  if (!invoice) return res.status(404).json({ success: false, message: 'That job could not be found' });

  const comment = await JobComment.create({ invoiceNumber, authorName, authorRole, body });

  // Everyone on the job hears about it except whoever just wrote it.
  const sheet = invoice.payload?.orderSheet || {};
  const audience = new Set(['production_manager', 'store_manager']);
  audience.delete(authorRole);
  await notifyRoles(
    [...audience],
    `${authorName} commented on ${invoiceNumber}: ${body.length > 90 ? `${body.slice(0, 90)}…` : body}`,
    { invoiceNumber, event: 'job_comment' }
  );

  // A tailor's notifications are addressed by name through metadata.tailorName,
  // which is how the inbox filters them, rather than by a recipient column.
  if (sheet.tailor && sheet.tailor !== 'Unassigned' && authorName !== sheet.tailor) {
    await notifyRoles(
      ['tailor'],
      `${authorName} commented on ${invoiceNumber}: ${body.length > 90 ? `${body.slice(0, 90)}…` : body}`,
      { invoiceNumber, event: 'job_comment', tailorName: sheet.tailor }
    );
  }

  res.status(201).json({ success: true, data: { comment } });
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

router.get('/inventory-types', asyncHandler(async (req, res) => {
  const types = await readSetting(INVENTORY_TYPES_KEY, DEFAULT_INVENTORY_TYPES);
  res.json({ success: true, data: { types, units: INVENTORY_UNITS } });
}));

router.post('/inventory-types', asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'A name is required' });

  const types = await readSetting(INVENTORY_TYPES_KEY, DEFAULT_INVENTORY_TYPES);
  if (types.some((type) => type.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ success: false, message: `${name} is already an inventory type` });
  }

  const next = [...types, name];
  await writeSetting(INVENTORY_TYPES_KEY, next, 'oms');
  res.status(201).json({ success: true, data: { types: next, units: INVENTORY_UNITS } });
}));

router.delete('/inventory-types/:name', asyncHandler(async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const types = await readSetting(INVENTORY_TYPES_KEY, DEFAULT_INVENTORY_TYPES);

  // Removing a type that items are filed under would leave those items
  // pointing at something that no longer exists.
  const inUse = await Fabric.count({ where: { type: name } });
  if (inUse) {
    return res.status(409).json({
      success: false,
      message: inUse === 1
        ? `1 item still uses ${name}. Move it to another type first.`
        : `${inUse} items still use ${name}. Move them to another type first.`,
    });
  }

  const next = types.filter((type) => type !== name);
  await writeSetting(INVENTORY_TYPES_KEY, next, 'oms');
  res.json({ success: true, data: { types: next, units: INVENTORY_UNITS } });
}));

router.post('/fabrics', asyncHandler(async (req, res) => {
  const { sku, name, type, colour, quantity = 0, unit = 'units', cost, location, supplier, lowStockThreshold = 0, image } = req.body;
  const numericQuantity = Number(quantity);
  const numericThreshold = Number(lowStockThreshold);
  const numericCost = cost === undefined || cost === null || cost === '' ? null : Number(cost);

  if (!String(name || '').trim() || !String(type || '').trim() || !String(unit || '').trim()) {
    return res.status(400).json({
      success: false,
      message: 'name, type, and unit are required',
    });
  }

  const types = await readSetting(INVENTORY_TYPES_KEY, DEFAULT_INVENTORY_TYPES);
  if (!types.includes(String(type).trim())) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid inventory type',
    });
  }
  if (!INVENTORY_UNITS.includes(String(unit).trim())) {
    return res.status(400).json({
      success: false,
      message: `Unit must be one of: ${INVENTORY_UNITS.join(', ')}`,
    });
  }
  if (!Number.isFinite(numericQuantity) || !Number.isFinite(numericThreshold)
    || numericQuantity < 0 || numericThreshold < 0) {
    return res.status(400).json({
      success: false,
      message: 'Quantity and low-stock threshold must be valid non-negative numbers',
    });
  }
  if (numericCost !== null && (!Number.isFinite(numericCost) || numericCost < 0)) {
    return res.status(400).json({ success: false, message: 'Cost must be a valid non-negative number' });
  }

  const trimmedSku = String(sku || '').trim();
  if (trimmedSku) {
    const clash = await Fabric.findOne({ where: { sku: trimmedSku } });
    if (clash) {
      return res.status(409).json({ success: false, message: `SKU ${trimmedSku} is already used by ${clash.name}` });
    }
  }

  const fabric = await Fabric.create({
    sku: trimmedSku || null,
    name: String(name).trim(),
    type: String(type).trim(),
    colour: String(colour || '').trim() || null,
    quantity: numericQuantity,
    unit: String(unit).trim(),
    cost: numericCost,
    location: String(location || '').trim() || null,
    supplier: String(supplier || '').trim() || null,
    lowStockThreshold: numericThreshold,
    image: safeImageDataUrl(image),
  });
  await notifyRoles(
    ['accounts'],
    `${fabric.name} was added to inventory: ${Number(fabric.quantity)} ${fabric.unit}.`,
    { fabricId: fabric.id, event: 'inventory_created' }
  );
  res.status(201).json({ success: true, data: { fabric } });
}));

// Item photos are data URLs measured in hundreds of kilobytes, so they are left
// out of the list and fetched one at a time from the endpoint below — otherwise
// opening the inventory page would download every photo in the shop at once.
const FABRIC_LIST_ATTRIBUTES = {
  exclude: ['image'],
  include: [[db.sequelize.literal('CASE WHEN "image" IS NOT NULL THEN true ELSE false END'), 'hasImage']],
};

router.get('/fabrics', asyncHandler(async (req, res) => {
  const fabrics = await Fabric.findAll({ attributes: FABRIC_LIST_ATTRIBUTES, order: [['name', 'ASC']] });
  res.json({ success: true, data: { fabrics } });
}));

// `/fabrics/allocations` is a list, not an item id, and it is declared further
// down the file — so anything that is not an id is handed straight on rather
// than being swallowed here.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const onlyItemIds = (req, res, next) => (UUID_PATTERN.test(req.params.id) ? next() : next('route'));

router.get('/fabrics/:id', onlyItemIds, asyncHandler(async (req, res) => {
  const fabric = await Fabric.findByPk(req.params.id, { attributes: FABRIC_LIST_ATTRIBUTES });
  if (!fabric) return res.status(404).json({ success: false, message: 'Inventory item not found' });

  // What this item has been used on, so the detail page can show its movement
  // rather than just its current count.
  const allocations = await db.InventoryAllocation.findAll({
    where: { fabricId: fabric.id },
    order: [['createdAt', 'DESC']],
    limit: 25,
  });

  res.json({ success: true, data: { fabric, allocations } });
}));

router.get('/fabrics/:id/image', asyncHandler(async (req, res) => {
  const fabric = await Fabric.findByPk(req.params.id, { attributes: ['id', 'image', 'updatedAt'] });
  const match = IMAGE_DATA_URL.exec(fabric?.image || '');
  const type = match?.[1].toLowerCase();
  if (!type || !ALLOWED_IMAGE_TYPES.has(type)) {
    return res.status(404).json({ success: false, message: 'No image for this item' });
  }

  // Served from the same origin as the app, so the browser is told exactly what
  // this is, not to guess, and not to treat it as a document.
  res.set('Content-Type', type);
  res.set('X-Content-Type-Options', 'nosniff');
  // The app is served from a different origin to the API, and helmet's default
  // same-origin resource policy would stop the browser rendering this at all.
  // CORS still decides who may request it.
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Content-Disposition', `inline; filename="inventory-${fabric.id}"`);
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  res.set('Cache-Control', 'private, max-age=300');
  res.send(Buffer.from(match[2], 'base64'));
}));

router.post('/fabrics/:id/edit-requests', asyncHandler(async (req, res) => {
  const fabric = await Fabric.findByPk(req.params.id);
  if (!fabric) return res.status(404).json({ success: false, message: 'Inventory item not found' });
  const { proposedChanges = {}, reason, requestedBy = 'Inventory Manager', requestedByRole = 'inventory_manager' } = req.body;
  if (requestedByRole !== 'inventory_manager') return res.status(403).json({ success: false, message: 'Only the Inventory Manager can submit inventory edit requests.' });
  if (!String(reason || '').trim()) return res.status(400).json({ success: false, message: 'A reason for the requested edit is required.' });
  const allowed = ['name', 'type', 'unit', 'supplier', 'quantity', 'lowStockThreshold'];
  const changes = Object.fromEntries(Object.entries(proposedChanges).filter(([key]) => allowed.includes(key)));
  if (Object.prototype.hasOwnProperty.call(changes, 'quantity')) {
    changes.quantity = Number(changes.quantity);
    if (!Number.isFinite(changes.quantity) || changes.quantity < 0) return res.status(400).json({ success: false, message: 'Quantity must be a valid non-negative number.' });
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'lowStockThreshold')) {
    changes.lowStockThreshold = Number(changes.lowStockThreshold);
    if (!Number.isFinite(changes.lowStockThreshold) || changes.lowStockThreshold < 0) return res.status(400).json({ success: false, message: 'Low-stock threshold must be a valid non-negative number.' });
  }
  if (!Object.keys(changes).length) return res.status(400).json({ success: false, message: 'At least one proposed change is required.' });
  const request = await InventoryEditRequest.create({ fabricId: fabric.id, requestedBy, requestedByRole, proposedChanges: changes, reason: String(reason).trim() });
  await notifyRoles(['owner', 'admin', 'accounts'], `${requestedBy} requested changes to inventory item ${fabric.name}. Owner approval is required.`, { event: 'inventory_edit_requested', requestId: request.id, fabricId: fabric.id });
  return res.status(201).json({ success: true, data: { request } });
}));

router.get('/inventory-edit-requests', asyncHandler(async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : {};
  const requests = await InventoryEditRequest.findAll({ where, order: [['createdAt', 'DESC']] });
  const fabrics = await Fabric.findAll({ where: { id: requests.map((request) => request.fabricId) } });
  const byId = new Map(fabrics.map((fabric) => [fabric.id, fabric]));
  res.json({ success: true, data: { requests: requests.map((request) => ({ ...request.toJSON(), fabric: byId.get(request.fabricId) || null })) } });
}));

router.patch('/inventory-edit-requests/:id/review', requireRole('owner'), asyncHandler(async (req, res) => {
  const { decision, reviewNote = '' } = req.body;
  const owner = req.staff;
  if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Decision must be Approved or Rejected.' });
  const request = await InventoryEditRequest.findByPk(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Inventory edit request not found.' });
  if (request.status !== 'Pending Owner Approval') return res.status(409).json({ success: false, message: 'This request has already been reviewed.' });
  const fabric = await Fabric.findByPk(request.fabricId);
  if (!fabric) return res.status(404).json({ success: false, message: 'Inventory item not found.' });
  await db.sequelize.transaction(async (transaction) => {
    if (decision === 'Approved') await fabric.update(request.proposedChanges, { transaction });
    await request.update({ status: decision, reviewedBy: owner.displayName, reviewedAt: new Date(), reviewNote }, { transaction });
  });
  await notifyRoles(['inventory_manager', 'admin', 'accounts'], `Inventory edit request for ${fabric.name} was ${decision.toLowerCase()} by ${owner.displayName}.`, { event: `inventory_edit_${decision.toLowerCase()}`, requestId: request.id, fabricId: fabric.id });
  res.json({ success: true, data: { request, fabric } });
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


// ── SETTINGS AND MEMBERSHIP TIERS ─────────────────────────────────────────
// Both live as JSON rows in PlatformSettings rather than tables of their own,
// so they need no migration to reach an environment.

const SETTINGS_KEY = 'oms.settings';
const TIERS_KEY = 'oms.membership_tiers';

const DEFAULT_SETTINGS = {
  businessName: 'The Way It Fits',
  supportEmail: '',
  supportPhone: '',
  invoicePrefix: 'INV',
  invoiceValidityHours: 48,
  productionLeadTimeWeeks: 4,
  collectionReminderDays: 7,
  lowStockThreshold: 5,
  currency: 'NGN',
  requirePaymentEvidence: true,
  // How much of an invoice has to be paid before the order may be worked.
  // Settled with Henry on 12 August: 70%, changeable here. The invoice asks the
  // customer for 80% upfront, which leaves a little room above the gate.
  paymentReleasePercent: 70,
  notifyOnLowStock: true,
  notifyOnNewInvoice: true,
};

// Elite is the tier the invoice discount reads from; the rest describe where a
// customer sits. Discounts are percentages of the invoice subtotal.
const DEFAULT_TIERS = [
  { id: 'new', name: 'New', discountPercent: 0, colour: '#8a7a6a', description: 'Created manually, no confirmed orders yet.', minSpend: 0, minOrders: 0, minMonths: 0, isDefault: true },
  { id: 'active', name: 'Active', discountPercent: 0, colour: '#2a7d4f', description: 'Has ordered within the last 12 months.', minSpend: 0, minOrders: 1, minMonths: 0, isDefault: true },
  { id: 'non-active', name: 'Non-Active', discountPercent: 0, colour: '#8a3520', description: 'No confirmed orders in the last 12 months.', minSpend: 0, minOrders: 0, minMonths: 12, isDefault: true },
  { id: 'elite', name: 'Elite Member', discountPercent: 5, colour: '#c97b08', description: 'Automatic discount on every invoice.', minSpend: 3000000, minOrders: 12, minMonths: 12, isDefault: true },
];

const readSetting = async (key, fallback) => {
  const row = await db.PlatformSettings.findOne({ where: { key } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
};

const writeSetting = async (key, value, category) => {
  const [row, created] = await db.PlatformSettings.findOrCreate({
    where: { key },
    defaults: { key, value: JSON.stringify(value), dataType: 'json', category },
  });
  if (!created) await row.update({ value: JSON.stringify(value), dataType: 'json', category });
  return value;
};

const slugForTier = (name) => String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

router.get('/settings', asyncHandler(async (req, res) => {
  const stored = await readSetting(SETTINGS_KEY, {});
  res.json({ success: true, data: { settings: { ...DEFAULT_SETTINGS, ...stored } } });
}));

// Settings decide how the shop runs — the payment gate among them — so they
// are the Owner's and Admin's to change, not any signed-in member of staff's.
router.put('/settings', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const incoming = req.body || {};
  // Only known keys are stored, so the settings row cannot become a dumping
  // ground for whatever a client happens to post.
  const next = Object.fromEntries(Object.keys(DEFAULT_SETTINGS)
    .filter((key) => Object.prototype.hasOwnProperty.call(incoming, key))
    .map((key) => {
      const fallback = DEFAULT_SETTINGS[key];
      const value = incoming[key];
      if (typeof fallback === 'number') return [key, Number.isFinite(Number(value)) ? Number(value) : fallback];
      if (typeof fallback === 'boolean') return [key, Boolean(value)];
      return [key, String(value ?? '').trim()];
    }));

  // A release threshold outside 0–100 would either hold every order for ever or
  // let every one through.
  if ('paymentReleasePercent' in next) {
    next.paymentReleasePercent = Math.min(100, Math.max(0, Math.round(next.paymentReleasePercent)));
  }

  const current = await readSetting(SETTINGS_KEY, {});
  const settings = { ...DEFAULT_SETTINGS, ...current, ...next };
  await writeSetting(SETTINGS_KEY, settings, 'oms');
  res.json({ success: true, data: { settings } });
}));

router.get('/membership-tiers', asyncHandler(async (req, res) => {
  const tiers = await readSetting(TIERS_KEY, DEFAULT_TIERS);
  const customers = await Customer.findAll({ order: [['createdAt', 'DESC']] });

  // Customers are counted against the tier their category names, so the page
  // shows who is actually on each tier rather than a static number.
  const withCounts = tiers.map((tier) => {
    const members = customers.filter((customer) => slugForTier(customer.category || 'New') === tier.id);
    return {
      ...tier,
      memberCount: members.length,
      members: members.slice(0, 50).map((customer) => ({
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        storeCreditBalance: Number(customer.storeCreditBalance || 0),
        createdAt: customer.createdAt,
      })),
    };
  });

  const known = new Set(tiers.map((tier) => tier.id));
  const unassigned = customers.filter((customer) => !known.has(slugForTier(customer.category || 'New')));

  res.json({ success: true, data: { tiers: withCounts, unassignedCount: unassigned.length } });
}));

router.post('/membership-tiers', asyncHandler(async (req, res) => {
  const { name, discountPercent = 0, colour = '#8a7a6a', description = '', minSpend = 0, minOrders = 0, minMonths = 0 } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ success: false, message: 'A membership name is required.' });

  const discount = Number(discountPercent);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    return res.status(400).json({ success: false, message: 'Discount must be between 0 and 100.' });
  }

  const tiers = await readSetting(TIERS_KEY, DEFAULT_TIERS);
  const id = slugForTier(name);
  if (!id) return res.status(400).json({ success: false, message: 'That membership name cannot be used.' });
  if (tiers.some((tier) => tier.id === id)) {
    return res.status(409).json({ success: false, message: 'A membership with that name already exists.' });
  }

  const tier = {
    id,
    name: String(name).trim(),
    discountPercent: discount,
    colour,
    description: String(description || '').trim(),
    minSpend: Number(minSpend) || 0,
    minOrders: Number(minOrders) || 0,
    minMonths: Number(minMonths) || 0,
    isDefault: false,
  };
  await writeSetting(TIERS_KEY, [...tiers, tier], 'oms');
  await notifyRoles(['owner', 'admin'], `A new membership "${tier.name}" was created at ${tier.discountPercent}% discount.`, { event: 'membership_created', tierId: tier.id });
  res.status(201).json({ success: true, data: { tier } });
}));

router.patch('/membership-tiers/:id', asyncHandler(async (req, res) => {
  const tiers = await readSetting(TIERS_KEY, DEFAULT_TIERS);
  const index = tiers.findIndex((tier) => tier.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Membership not found.' });

  const { name, discountPercent, colour, description, minSpend, minOrders, minMonths } = req.body || {};
  if (discountPercent !== undefined) {
    const discount = Number(discountPercent);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      return res.status(400).json({ success: false, message: 'Discount must be between 0 and 100.' });
    }
  }

  const existing = tiers[index];
  const updated = {
    ...existing,
    // The id is the link to a customer's category, so renaming a built-in
    // membership must not move every customer off it.
    name: name !== undefined && String(name).trim() ? String(name).trim() : existing.name,
    discountPercent: discountPercent !== undefined ? Number(discountPercent) : existing.discountPercent,
    colour: colour ?? existing.colour,
    description: description !== undefined ? String(description).trim() : existing.description,
    minSpend: minSpend !== undefined ? Number(minSpend) || 0 : existing.minSpend,
    minOrders: minOrders !== undefined ? Number(minOrders) || 0 : existing.minOrders,
    minMonths: minMonths !== undefined ? Number(minMonths) || 0 : existing.minMonths,
  };

  const next = [...tiers];
  next[index] = updated;
  await writeSetting(TIERS_KEY, next, 'oms');
  res.json({ success: true, data: { tier: updated } });
}));

router.delete('/membership-tiers/:id', asyncHandler(async (req, res) => {
  const tiers = await readSetting(TIERS_KEY, DEFAULT_TIERS);
  const tier = tiers.find((item) => item.id === req.params.id);
  if (!tier) return res.status(404).json({ success: false, message: 'Membership not found.' });
  if (tier.isDefault) {
    return res.status(409).json({ success: false, message: 'The built-in memberships cannot be deleted. Edit them instead.' });
  }

  const inUse = await Customer.count({ where: { category: tier.name } });
  if (inUse) {
    return res.status(409).json({ success: false, message: `${inUse} customer${inUse === 1 ? ' is' : 's are'} on this membership. Move them first.` });
  }

  await writeSetting(TIERS_KEY, tiers.filter((item) => item.id !== tier.id), 'oms');
  res.json({ success: true, message: 'Membership deleted.' });
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
  // Lead time is the working life of an order: from the day the order sheet was
  // raised to the day production marked it ready. Only finished orders count —
  // an order still in the shop has no lead time yet, and counting it would make
  // the figure improve every time nothing happened.
  const leadTimeSetting = Number((await readSetting(SETTINGS_KEY, {})).productionLeadTimeWeeks
    ?? DEFAULT_SETTINGS.productionLeadTimeWeeks);
  const targetDays = leadTimeSetting * 7;

  const completed = readyOrders.map((invoice) => {
    const sheet = invoice.payload?.orderSheet || {};
    const raised = new Date(sheet.createdAt || invoice.createdAt);
    const finished = new Date(sheet.updatedAt || invoice.updatedAt);
    const days = Math.max(0, Math.round((finished - raised) / 86400000));
    return {
      invoiceNumber: invoice.invoiceNumber,
      customer: invoice.customerName,
      days,
      // Against the shop's own standard, and against what the customer was
      // promised where a delivery date was given.
      withinTarget: days <= targetDays,
      promised: sheet.delivery || null,
      onPromise: sheet.delivery ? finished <= new Date(`${sheet.delivery}T23:59:59`) : null,
      finishedAt: finished.toISOString(),
    };
  });

  const promised = completed.filter((order) => order.onPromise !== null);
  const leadTime = {
    targetDays,
    completedCount: completed.length,
    averageDays: completed.length
      ? Number((completed.reduce((sum, order) => sum + order.days, 0) / completed.length).toFixed(1))
      : null,
    withinTargetPercent: completed.length
      ? Math.round((completed.filter((order) => order.withinTarget).length / completed.length) * 100)
      : null,
    onPromisePercent: promised.length
      ? Math.round((promised.filter((order) => order.onPromise).length / promised.length) * 100)
      : null,
    promisedCount: promised.length,
    slowest: [...completed].sort((a, b) => b.days - a.days).slice(0, 5),
  };

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
        leadTime,
        invoices: invoices.map((invoice) => ({
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.createdAt,
          customer: invoice.customerName,
          store: invoice.store === 'lekki' ? 'Lekki' : 'Ikeja',
          total: Number(invoice.total || 0),
          paymentStatus: paymentStatusLabel(invoice.paymentStatus),
          paymentMethod: invoice.payload?.paymentMethod
            ? `${invoice.payload.paymentMethod.charAt(0).toUpperCase()}${invoice.payload.paymentMethod.slice(1)}`
            : 'Transfer',
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

// Quantity still cannot be edited here: stock moves through allocation, or
// through an edit request the Owner approves. Everything else on an item is a
// description of it — a mistyped SKU or a shelf that has been moved — and had
// no way of being corrected at all.
const EDITABLE_FABRIC_FIELDS = ['sku', 'name', 'colour', 'cost', 'location', 'supplier', 'lowStockThreshold', 'image'];

router.patch('/fabrics/:id', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (body.quantity !== undefined) {
    return res.status(403).json({
      success: false,
      message: 'Quantity cannot be edited directly. Raise a stock edit request or allocate through production.',
    });
  }

  const fabric = await Fabric.findByPk(req.params.id);
  if (!fabric) return res.status(404).json({ success: false, message: 'Inventory item not found' });

  const changes = {};
  for (const field of EDITABLE_FABRIC_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const raw = body[field];

    if (field === 'cost' || field === 'lowStockThreshold') {
      if (raw === '' || raw === null) {
        if (field === 'cost') changes.cost = null;
        continue;
      }
      const numeric = Number(raw);
      if (!Number.isFinite(numeric) || numeric < 0) {
        return res.status(400).json({ success: false, message: `${field} must be a valid non-negative number` });
      }
      changes[field] = numeric;
      continue;
    }

    if (field === 'image') {
      const safe = safeImageDataUrl(raw);
      if (raw && !safe) {
        return res.status(400).json({ success: false, message: 'Item photos must be a PNG, JPEG, WebP or GIF' });
      }
      changes.image = safe;
      continue;
    }

    const trimmed = String(raw ?? '').trim();
    if (field === 'name' && !trimmed) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty' });
    }
    changes[field] = trimmed || (field === 'name' ? fabric.name : null);
  }

  if (changes.sku) {
    const clash = await Fabric.findOne({ where: { sku: changes.sku } });
    if (clash && clash.id !== fabric.id) {
      return res.status(409).json({ success: false, message: `SKU ${changes.sku} is already used by ${clash.name}` });
    }
  }

  await fabric.update(changes);
  const updated = await Fabric.findByPk(fabric.id, { attributes: FABRIC_LIST_ATTRIBUTES });
  res.json({ success: true, data: { fabric: updated } });
}));

router.delete('/fabrics/:id', asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: 'Inventory records cannot be deleted.' });
}));

module.exports = router;
