const express = require('express');
const router = express.Router();
const axios = require('axios');

const PRICES = { basic: 99, pro: 199, premium: 349 };

// POST /api/payment/create
router.post('/create', async (req, res) => {
  try {
    const { analysisId, reportType = 'basic', customerEmail = '' } = req.body;
    const amount = PRICES[reportType] || 99;
    const labels = { basic: 'Rapport Basic RiadPricer', pro: 'Rapport Pro RiadPricer', premium: 'Rapport Premium RiadPricer' };

    // Update DB with pending payment
    try {
      await global.db.query(
        'INSERT INTO payments (analysis_id, amount) VALUES ($1, $2)',
        [analysisId, amount * 100]
      );
    } catch(e) {}

    // Use PayZone API if keys available, else fallback PayLink
    let paymentUrl;

    if (process.env.PAYZONE_API_KEY && process.env.PAYZONE_SECRET_KEY) {
      try {
        const response = await axios.post('https://api.payzone.ma/v1/checkout', {
          merchant_id: process.env.PAYZONE_MERCHANT_ID,
          amount: amount * 100,
          currency: 'MAD',
          order_id: analysisId,
          description: labels[reportType],
          customer_email: customerEmail,
          return_url: process.env.FRONTEND_URL + '/success?id=' + analysisId,
          cancel_url: process.env.FRONTEND_URL + '/cancel',
          webhook_url: process.env.BACKEND_URL + '/api/payment/webhook'
        }, {
          headers: {
            'Authorization': 'Bearer ' + process.env.PAYZONE_API_KEY,
            'Content-Type': 'application/json'
          }
        });
        paymentUrl = response.data.checkout_url || response.data.payment_url;
      } catch(apiErr) {
        console.error('PayZone API error:', apiErr.message);
        paymentUrl = buildFallbackUrl(analysisId, amount, labels[reportType]);
      }
    } else {
      // No API key yet - use PayLink fallback
      paymentUrl = buildFallbackUrl(analysisId, amount, labels[reportType]);
    }

    res.json({ paymentUrl, amount, currency: 'MAD', analysisId, reportType });
  } catch(err) {
    console.error('Payment create error:', err);
    res.status(500).json({ error: err.message });
  }
});

function buildFallbackUrl(orderId, amount, description) {
  const base = process.env.PAYZONE_PAYLINK_URL || 'https://pay.payzone.ma';
  const merchant = process.env.PAYZONE_MERCHANT_ID || 'Papierentete';
  return base + '/' + merchant + '?amount=' + amount + '&ref=' + orderId + '&desc=' + encodeURIComponent(description);
}

// POST /api/payment/webhook
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    const orderId = body.order_id || body.reference || body.merchant_reference;
    const status = body.status || body.transaction_status;
    const txId = body.transaction_id || body.id;

    console.log('PayZone webhook:', JSON.stringify(body));

    if (orderId && (status === 'success' || status === 'paid' || status === 'PAID' || status === 'SUCCESS')) {
      await global.db.query(
        'UPDATE analyses SET payment_status = $1, payment_id = $2 WHERE id = $3',
        ['paid', txId, orderId]
      );
      await global.db.query(
        'UPDATE payments SET status = $1, payzone_ref = $2 WHERE analysis_id = $3',
        ['paid', txId, orderId]
      );
      console.log('Payment confirmed for analysis:', orderId);
    }

    res.json({ received: true, status: 'ok' });
  } catch(err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payment/status/:analysisId
router.get('/status/:analysisId', async (req, res) => {
  try {
    const result = await global.db.query(
      'SELECT payment_status, report_type FROM analyses WHERE id = $1',
      [req.params.analysisId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ status: result.rows[0].payment_status, reportType: result.rows[0].report_type });
  } catch(err) {
    // Dev mode: return paid status if no DB
    res.json({ status: 'paid', reportType: 'basic' });
  }
});

// POST /api/payment/confirm (manual confirmation for testing)
router.post('/confirm', async (req, res) => {
  try {
    const { analysisId, secret } = req.body;
    if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
    await global.db.query('UPDATE analyses SET payment_status = $1 WHERE id = $2', ['paid', analysisId]);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
