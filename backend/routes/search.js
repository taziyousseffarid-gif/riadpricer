const express = require('express');
const router = express.Router();
const SerpApi = require('google-search-results-nodejs');

const client = new SerpApi.GoogleSearch(process.env.SERPAPI_KEY);

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getDayAfter() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

function extractQuartier(address) {
  if (!address) return 'Medina';
  const q = ['Medina','Mellah','Palmeraie','Gueliz','Hivernage','Kasbah','Sidi Mimoun','Bab Doukkala'];
  for (const x of q) {
    if (address.toLowerCase().includes(x.toLowerCase())) return x;
  }
  return 'Medina';
}

function detectCategory(property) {
  const name = (property.name || '').toLowerCase();
  const rate = property.rate_per_night?.lowest || 0;
  if (name.includes('palace') || name.includes('palais') || rate > 3000) return 'Luxe (5 etoiles)';
  if (rate > 1500 || name.includes('boutique')) return 'Superieur (4 etoiles)';
  return 'Standard (3 etoiles)';
}

// POST /api/search
router.post('/', (req, res) => {
  const { query } = req.body;
  if (!query || query.length < 2) return res.status(400).json({ error: 'Query too short' });

  const params = {
    engine: 'google_hotels',
    q: query + ' riad Marrakech',
    check_in_date: getTomorrow(),
    check_out_date: getDayAfter(),
    gl: 'ma',
    hl: 'fr',
    currency: 'MAD',
    api_key: process.env.SERPAPI_KEY
  };

  client.json(params, (data) => {
    if (data.error) {
      return res.json({ results: getFallbackResults(query) });
    }
    const results = (data.properties || []).slice(0, 10).map(p => ({
      name: p.name,
      address: p.address,
      quartier: extractQuartier(p.address),
      rating: p.overall_rating,
      reviews: p.reviews,
      price: p.rate_per_night?.lowest,
      thumbnail: p.images?.[0]?.original_image,
      hotel_id: p.property_token,
      category: detectCategory(p),
      source: 'Google Hotels'
    })).filter(r => r.name);
    res.json({ results: results.length ? results : getFallbackResults(query) });
  });
});

// POST /api/search/details
router.post('/details', (req, res) => {
  const { hotel_id, name, address } = req.body;

  if (!hotel_id) {
    return res.json({
      details: {
        name, address,
        quartier: extractQuartier(address || ''),
        category: 'Standard (3 etoiles)',
        rating: 4.5,
        currentPrice: null,
        source: 'Manual'
      }
    });
  }

  const params = {
    engine: 'google_hotels',
    property_token: hotel_id,
    check_in_date: getTomorrow(),
    check_out_date: getDayAfter(),
    gl: 'ma', hl: 'fr', currency: 'MAD',
    api_key: process.env.SERPAPI_KEY
  };

  client.json(params, (data) => {
    if (data.error) return res.json({ details: { name, source: 'fallback' } });
    const p = data.property_details || {};
    res.json({
      details: {
        name: p.name || name,
        address: p.address,
        quartier: extractQuartier(p.address || address || ''),
        rating: p.overall_rating,
        reviews: p.reviews,
        currentPrice: p.rate_per_night?.lowest,
        category: detectCategory(p),
        amenities: p.amenities,
        source: 'Google Hotels'
      }
    });
  });
});

function getFallbackResults(query) {
  const riads = [
    { name: 'Riad Laila', address: '14 Derb Jdid, Medina, Marrakech', quartier: 'Medina', rating: 4.8, price: 950, category: 'Standard (3 etoiles)' },
    { name: 'Riad Yasmine', address: '18 Derb el Aoud, Medina, Marrakech', quartier: 'Medina', rating: 4.5, price: 680, category: 'Standard (3 etoiles)' },
    { name: 'Riad Kniza', address: '34 Derb l Osta, Medina, Marrakech', quartier: 'Medina', rating: 4.9, price: 1650, category: 'Superieur (4 etoiles)' },
    { name: 'El Fenn', address: '2 Derb Moulay Abdullah Ben Hezzian, Medina', quartier: 'Medina', rating: 4.9, price: 2800, category: 'Luxe (5 etoiles)' },
    { name: 'Riad BE Marrakech', address: '79 Arset Aouzal, Bab Doukkala', quartier: 'Bab Doukkala', rating: 4.8, price: 890, category: 'Standard (3 etoiles)' }
  ];
  const q = query.toLowerCase();
  return riads.filter(r => r.name.toLowerCase().includes(q) || q.length < 3).slice(0, 5);
}

module.exports = router;
