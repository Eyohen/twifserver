const jwt = require('jsonwebtoken');
const db = require('../models');

const { StaffUser } = db;

const TOKEN_TTL = process.env.STAFF_TOKEN_TTL || '12h';

// Staff carry their own token, separate from the customer-facing User accounts
// the rest of this codebase was built around.
const signStaffToken = (staff) => jwt.sign(
  { staffId: staff.id, role: staff.role },
  process.env.JWT_SECRET,
  { expiresIn: TOKEN_TTL },
);

// Every OMS route except sign-in and the customer's own tracking link goes
// through here. Until this existed the whole API was open: customer records,
// invoices and payment evidence were readable by anyone who knew the address.
const requireStaff = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Please sign in' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (!decoded?.staffId) {
      return res.status(401).json({ success: false, message: 'Please sign in' });
    }

    const staff = await StaffUser.findByPk(decoded.staffId, { attributes: { exclude: ['pinHash'] } });
    if (!staff) return res.status(401).json({ success: false, message: 'Please sign in' });
    if (staff.status !== 'active') {
      return res.status(403).json({ success: false, message: 'This account is no longer active' });
    }

    // Signing everyone out — after a leaver, say — is a matter of stamping
    // forceLogoutAt; tokens issued before it stop working.
    if (staff.forceLogoutAt && decoded.iat * 1000 < new Date(staff.forceLogoutAt).getTime()) {
      return res.status(401).json({ success: false, message: 'Please sign in again' });
    }

    req.staff = staff;
    return next();
  } catch (error) {
    const expired = error.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      message: expired ? 'Your session has ended. Please sign in again.' : 'Please sign in',
    });
  }
};

// Some actions belong to particular roles. Used sparingly and explicitly, so a
// route says who it is for.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.staff) return res.status(401).json({ success: false, message: 'Please sign in' });
  if (!roles.includes(req.staff.role)) {
    return res.status(403).json({ success: false, message: 'That is not yours to do' });
  }
  return next();
};

module.exports = { signStaffToken, requireStaff, requireRole, TOKEN_TTL };
