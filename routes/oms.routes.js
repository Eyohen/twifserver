const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../models');
const { createTwifInvoiceHtml, getTwifStoreDetails } = require('../utils/twifInvoiceTemplate');
const { sendEmail } = require('../services/email.service');

const router = express.Router();
const { StaffUser, Customer, Invoice, OrderSheet, Fabric, SentInvoice } = db;

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
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
  } = req.body;

  if (!phone || !pin || !displayName || !role) {
    return res.status(400).json({
      success: false,
      message: 'phone, pin, displayName, and role are required',
    });
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
      },
    },
  });
}));

router.get('/staff', asyncHandler(async (req, res) => {
  const staffUsers = await StaffUser.findAll({
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'phone', 'displayName', 'role', 'store', 'status', 'lastLoginAt', 'tailorDepartment', 'tailorGrade'],
  });

  res.json({ success: true, data: { staffUsers } });
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
  const customers = await Customer.findAll({
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

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
  const result = await sendEmail({
    to: recipientEmail,
    subject: `Invoice ${payload.invoiceNumber} from The Way It Fits`,
    html,
    text: plainTextInvoice(payload),
  });

  if (!result.success) {
    return res.status(502).json({
      success: false,
      message: 'Invoice email could not be sent',
      error: result.error,
    });
  }

  await SentInvoice.upsert({
    invoiceNumber: payload.invoiceNumber,
    store: payload.store === 'ikeja' ? 'ikeja' : 'lekki',
    customerName: payload.customer.name || payload.customer.fullName,
    customerEmail: recipientEmail,
    customerPhone: payload.customer.phone || null,
    createdByName: req.body.createdByName || 'Store Manager',
    total: Number(payload.balanceDue || 0),
    paymentStatus: payload.paymentStatus === 'fully_paid' ? 'fully_paid' : 'partial_paid',
    emailStatus: 'sent',
    orderStatus: paymentStatusLabel(payload.paymentStatus),
    messageId: result.messageId,
    payload: {
      ...payload,
      recipientEmail,
      accountApprovalStatus: 'Pending Accounts',
    },
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
  const nextOrderSheet = {
    ...(payload.orderSheet || {}),
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

  if (!name || !type) {
    return res.status(400).json({
      success: false,
      message: 'name and type are required',
    });
  }

  const fabric = await Fabric.create({ name, type, quantity, unit, supplier, lowStockThreshold });
  res.status(201).json({ success: true, data: { fabric } });
}));

router.get('/fabrics', asyncHandler(async (req, res) => {
  const fabrics = await Fabric.findAll({ order: [['name', 'ASC']] });
  res.json({ success: true, data: { fabrics } });
}));

module.exports = router;
