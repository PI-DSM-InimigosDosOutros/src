const express = require('express');
const router = express.Router();
router.post('/token', (req, res) => res.status(410).json({ success: false, error: 'Use o login com e-mail e senha.' }));

module.exports = router;
