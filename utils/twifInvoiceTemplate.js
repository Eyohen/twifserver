const STORE_DETAILS = {
  lekki: {
    key: 'lekki',
    label: 'Lekki Store',
    addressLines: [
      process.env.TWIF_LEKKI_ADDRESS_LINE_1 || 'Casa Kaysora Mall, Lekki Phase One, Lagos',
      process.env.TWIF_LEKKI_ADDRESS_LINE_2 || 'Pavilion Heights, Issac John Street, Ikeja GRA',
      process.env.TWIF_LEKKI_ADDRESS_LINE_3 || 'Opposite Radisson Hotel',
    ],
    phone: process.env.TWIF_LEKKI_PHONE || '+234 705 533 7410',
    email: process.env.TWIF_LEKKI_EMAIL || 'twifclothing@gmail.com',
  },
  ikeja: {
    key: 'ikeja',
    label: 'Ikeja Store',
    addressLines: [
      process.env.TWIF_IKEJA_ADDRESS_LINE_1 || 'Pavilion Heights, Issac John Street, Ikeja GRA',
      process.env.TWIF_IKEJA_ADDRESS_LINE_2 || 'Ikeja, Lagos',
    ],
    phone: process.env.TWIF_IKEJA_PHONE || '+234 705 533 7410',
    email: process.env.TWIF_IKEJA_EMAIL || 'twifclothing@gmail.com',
  },
};

const BANK_DETAILS = {
  accountNumber: process.env.TWIF_BANK_ACCOUNT_NUMBER || '5600520467',
  accountName: process.env.TWIF_BANK_ACCOUNT_NAME || 'The Way It Fits Clothing',
  bankName: process.env.TWIF_BANK_NAME || 'Fidelity Bank',
};

const normalizeStore = (store = 'lekki') => {
  const key = String(store).trim().toLowerCase();
  return STORE_DETAILS[key] ? key : 'lekki';
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatNaira = (value = 0) => {
  const amount = Number(value) || 0;
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

const paymentStatusLabel = (value = 'partial_paid') => (
  String(value).toLowerCase() === 'fully_paid' ? 'Fully Paid' : 'Partial Paid'
);

const getTwifStoreDetails = (store) => STORE_DETAILS[normalizeStore(store)];

const buildRows = (items = []) => items.map((item, index) => {
  const rate = Number(item.rate ?? item.unitPrice ?? 0);
  const quantity = Number(item.quantity ?? item.qty ?? 1);
  const discount = Number(item.discountAmount ?? 0);
  const discountPercent = Number(item.discountPercent ?? 0);
  const amount = Number(item.amount ?? (rate * quantity) - discount);
  const hasFullDiscount = discountPercent >= 100;
  const stripe = index % 2 === 1 ? 'background:#f4f4f4;' : '';

  return `
    <tr>
      <td style="padding:16px 14px;${stripe}">
        <strong style="display:block;color:#2a2a2a;font-size:14px;">${escapeHtml(item.description || item.name || 'Invoice item')}</strong>
        ${item.note ? `<span style="display:block;color:#888;font-size:12px;margin-top:4px;">${escapeHtml(item.note)}</span>` : ''}
      </td>
      <td style="padding:16px 14px;text-align:right;color:${hasFullDiscount ? '#888' : '#4a4a4a'};${hasFullDiscount ? 'text-decoration:line-through;' : ''}${stripe}">${formatNaira(rate)}</td>
      <td style="padding:16px 14px;text-align:center;color:#4a4a4a;${stripe}">${quantity}</td>
      <td style="padding:16px 14px;text-align:center;${stripe}">
        ${discountPercent ? `<span style="display:inline-block;background:#f7dede;color:#c2453a;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800;">${discountPercent}%</span>` : '<span style="color:#777;">—</span>'}
      </td>
      <td style="padding:16px 14px;text-align:right;color:#2a2a2a;font-weight:800;${stripe}">${formatNaira(amount)}</td>
    </tr>
  `;
}).join('');

const createTwifInvoiceHtml = ({
  store = 'lekki',
  invoiceNumber,
  invoiceDate = new Date(),
  dueDate = new Date(),
  customer = {},
  items = [],
  subtotal,
  eliteDiscountAmount = 0,
  storeCreditApplied = 0,
  balanceDue,
  paymentStatus = 'partial_paid',
  trackingUrl,
  notes = [],
  validityText = 'This invoice is only valid for 48 hours.',
} = {}) => {
  const storeDetails = getTwifStoreDetails(store);
  const computedSubtotal = subtotal ?? items.reduce((sum, item) => {
    const rate = Number(item.rate ?? item.unitPrice ?? 0);
    const quantity = Number(item.quantity ?? item.qty ?? 1);
    return sum + (rate * quantity);
  }, 0);
  const computedBalance = balanceDue ?? Math.max(
    Number(computedSubtotal) - Number(eliteDiscountAmount) - Number(storeCreditApplied),
    0
  );
  const safeInvoiceNumber = escapeHtml(invoiceNumber || 'INV00000');
  const storeLabel = escapeHtml(storeDetails.label);
  const safePaymentStatus = escapeHtml(paymentStatusLabel(paymentStatus));
  const safeTrackingUrl = escapeHtml(trackingUrl || '#');
  const defaultNotes = [
    'Your order will be ready in 3–4 weeks from date of payment and measurements.',
    validityText,
  ];
  const displayNotes = notes.length ? notes : defaultNotes;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Twif Invoice ${safeInvoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#e8e8e8;font-family:Inter,Arial,sans-serif;color:#2a2a2a;">
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">
    Invoice ${safeInvoiceNumber} from ${storeLabel}. Balance due ${formatNaira(computedBalance)}.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8e8e8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="width:760px;max-width:100%;background:#ffffff;border-collapse:collapse;">
          <tr>
            <td style="padding:36px 42px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:top;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:88px;height:88px;background:#171717;border-radius:6px;text-align:center;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-1px;">twif</td>
                        <td style="padding-left:18px;vertical-align:top;">
                          <h1 style="margin:4px 0 8px;color:#202020;font-size:28px;line-height:1.1;">The Way It Fits</h1>
                          <p style="margin:0;color:#888;font-size:13px;line-height:1.55;">
                            ${storeDetails.addressLines.map(escapeHtml).join('<br>')}<br>
                            ${escapeHtml(storeDetails.phone)} · ${escapeHtml(storeDetails.email)}
                          </p>
                          <span style="display:inline-block;margin-top:12px;border:1px solid #d9b45a;border-radius:999px;background:#fff9e8;color:#8a6419;padding:5px 13px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">${storeLabel}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width:210px;text-align:right;vertical-align:top;">
                    <p style="margin:0 0 6px;color:#888;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">Invoice</p>
                    <h2 style="margin:0 0 20px;color:#202020;font-size:28px;line-height:1;">${safeInvoiceNumber}</h2>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
                      <tr>
                        <td style="color:#999;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;text-align:left;">Date</td>
                        <td style="color:#999;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;text-align:right;">Due Date</td>
                      </tr>
                      <tr>
                        <td style="padding-top:6px;font-size:14px;font-weight:800;text-align:left;">${escapeHtml(formatDate(invoiceDate))}</td>
                        <td style="padding-top:6px;font-size:14px;font-weight:800;text-align:right;">${escapeHtml(formatDate(dueDate))}</td>
                      </tr>
                    </table>
                    <div style="display:inline-block;background:#171717;border-radius:6px;padding:14px 20px;text-align:center;">
                      <p style="margin:0 0 7px;color:#a7a7a7;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Balance Due</p>
                      <strong style="color:#d3ab4f;font-size:26px;line-height:1;">${formatNaira(computedBalance)}</strong>
                    </div>
                    <div style="margin-top:10px;text-align:right;">
                      <span style="display:inline-block;border:1px solid #d9b45a;border-radius:999px;background:#fff9e8;color:#8a6419;padding:6px 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">${safePaymentStatus}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="height:2px;background:#202020;margin:34px 0 38px;"></div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:34px;">
                <tr>
                  <td style="width:48%;background:#f8f8f8;border:1px solid #dddddd;border-radius:6px;padding:20px;vertical-align:top;">
                    <p style="margin:0 0 12px;color:#999;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">Bill To</p>
                    <strong style="display:block;margin-bottom:6px;font-size:20px;color:#2a2a2a;">${escapeHtml(customer.name || customer.fullName || 'Customer')}</strong>
                    <span style="color:#888;font-size:14px;">${escapeHtml(customer.phone || '')}</span>
                  </td>
                  <td style="width:4%;"></td>
                  <td style="width:48%;background:#f8f8f8;border:1px solid #dddddd;border-radius:6px;padding:20px;vertical-align:top;">
                    <p style="margin:0 0 12px;color:#999;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">Payment Instructions</p>
                    <strong style="display:block;font-size:22px;color:#2a2a2a;letter-spacing:.08em;">${escapeHtml(BANK_DETAILS.accountNumber)}</strong>
                    <strong style="display:block;margin-top:8px;color:#2a2a2a;font-size:13px;">${escapeHtml(BANK_DETAILS.accountName)}</strong>
                    <span style="display:block;margin-top:5px;color:#777;font-size:13px;">${escapeHtml(BANK_DETAILS.bankName)}</span>
                    <span style="display:block;margin-top:9px;color:#888;font-size:12px;line-height:1.55;">80% upfront or full payment required to start order.<br>Non-refundable.</span>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:26px;">
                <thead>
                  <tr style="background:#171717;">
                    <th align="left" style="padding:13px 14px;color:#ffffff;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Description</th>
                    <th align="right" style="padding:13px 14px;color:#ffffff;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Rate</th>
                    <th align="center" style="padding:13px 14px;color:#ffffff;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Qty</th>
                    <th align="center" style="padding:13px 14px;color:#ffffff;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Discount</th>
                    <th align="right" style="padding:13px 14px;color:#ffffff;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${buildRows(items)}
                </tbody>
              </table>

              <div style="height:2px;background:#202020;margin:8px 0 24px;"></div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:48%;vertical-align:top;">
                    <h3 style="margin:0 0 16px;color:#2a2a2a;font-size:16px;letter-spacing:.08em;text-transform:uppercase;">Other Notes</h3>
                    ${displayNotes.map((note) => `
                      <p style="margin:0 0 12px;color:#888;font-size:13px;line-height:1.55;">
                        <span style="color:#c9a24b;font-weight:800;">•</span>
                        ${escapeHtml(note)}
                      </p>
                    `).join('')}
                  </td>
                  <td style="width:8%;"></td>
                  <td style="width:44%;vertical-align:top;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:8px 0;color:#555;">Subtotal</td>
                        <td style="padding:8px 0;text-align:right;font-weight:800;">${formatNaira(computedSubtotal)}</td>
                      </tr>
                      ${Number(eliteDiscountAmount) > 0 ? `
                        <tr>
                          <td style="padding:8px 0;color:#9a7830;font-weight:800;">★ 5% Elite Discount Applied</td>
                          <td style="padding:8px 0;text-align:right;color:#c2453a;font-weight:800;">-${formatNaira(eliteDiscountAmount)}</td>
                        </tr>
                      ` : ''}
                      ${Number(storeCreditApplied) > 0 ? `
                        <tr>
                          <td style="padding:8px 0;color:#9a7830;font-weight:800;">Store credit applied</td>
                          <td style="padding:8px 0;text-align:right;color:#c2453a;font-weight:800;">-${formatNaira(storeCreditApplied)}</td>
                        </tr>
                      ` : ''}
                    </table>
                    <div style="height:2px;background:#202020;margin:8px 0 14px;"></div>
                    <div style="background:#171717;border-radius:6px;padding:16px;text-align:right;">
                      <span style="display:inline-block;margin-right:12px;color:#a7a7a7;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Balance Due · NGN</span>
                      <strong style="color:#d3ab4f;font-size:28px;">${formatNaira(computedBalance)}</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:34px;background:#171717;border-radius:7px;">
                <tr>
                  <td style="padding:22px 24px;color:#d8d8d8;">
                    <h3 style="margin:0 0 10px;color:#d3ab4f;font-size:14px;letter-spacing:.16em;text-transform:uppercase;">Track Your Order Online</h3>
                    <p style="margin:0 0 18px;color:#cccccc;font-size:13px;line-height:1.55;">Tap the link below to view your order status, delivery date, and membership progress — no login required.</p>
                    <a href="${safeTrackingUrl}" style="display:inline-block;max-width:100%;background:#2b2b2b;border:1px solid #444;border-radius:5px;color:#ffffff;font-family:Monaco,Consolas,monospace;font-size:13px;font-weight:800;line-height:1.45;padding:10px 14px;text-decoration:none;word-break:break-all;">${safeTrackingUrl}</a>
                    <p style="margin:12px 0 0;color:#777;font-size:12px;text-align:center;">Unique to your account · Works on any device</p>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background:#e5e5e5;margin:34px 0 18px;"></div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:50%;vertical-align:top;padding-right:18px;">
                    <p style="margin:0 0 10px;color:#888;font-size:12px;line-height:1.55;"><span style="color:#c9a24b;font-weight:800;">•</span> Only payment made to THE WAY IT FITS CLOTHING account will be acknowledged.</p>
                    <p style="margin:0;color:#888;font-size:12px;line-height:1.55;"><span style="color:#c9a24b;font-weight:800;">•</span> Delivery and shipping are not included in the cost.</p>
                  </td>
                  <td style="width:50%;vertical-align:top;padding-left:18px;">
                    <p style="margin:0 0 10px;color:#888;font-size:12px;line-height:1.55;"><span style="color:#c9a24b;font-weight:800;">•</span> Alteration is free but we do not cover delivery or logistics cost for alterations.</p>
                    <p style="margin:0;color:#888;font-size:12px;line-height:1.55;"><span style="color:#c9a24b;font-weight:800;">•</span> Clothes not picked up after three (3) months will be forfeited.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = {
  BANK_DETAILS,
  STORE_DETAILS,
  createTwifInvoiceHtml,
  getTwifStoreDetails,
};
