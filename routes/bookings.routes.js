const express = require('express');
const bookingsController = require('../controllers/bookings.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', verifyToken, bookingsController.listBookings);
router.post('/', verifyToken, bookingsController.createBooking);
router.patch('/:id/accept', verifyToken, bookingsController.acceptBooking);
router.patch('/:id/decline', verifyToken, bookingsController.declineBooking);
router.patch('/:id/cancel', verifyToken, bookingsController.cancelBooking);

module.exports = router;
