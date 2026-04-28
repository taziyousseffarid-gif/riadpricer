const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getCompetitors } = require('../services/competitors');
const { getMarrakechEvents } = require('../services/events');
const { calculateOptimalPrice } = require('../services/pricing');

// POST /api/analyze
router.post('/', async (req, res) => {
  try {
    const { riadData, rooms, reportType = 'basic' } = req.body;
    if (!riadData || !rooms) return res.status(400).json({ error: 'Missing riadData or rooms' });

    const analysisId = uuidv4();

    try {
      await global.db.query(
        'INSERT INTO analyses (id, riad_name, riad_data, report_type) VALUES ($1, $2, $3, $4)',
        [analysisId, riadData.name, JSON.stringify(riadData), reportType]
      );
    } catch(e) { console.log('DB insert skipped'); }

    const [competitors, events, pricing] = await Promise.all([
      getCompetitors(riadData, rooms, reportType),
      getMarrakechEvents(),
      calculateOptimalPrice(riadData, rooms)
    ]);

    const schoolHolidays = getSchoolHolidays();

    const analysisData = {
      id: analysisId,
      riad: { ...riadData, rooms },
      competitors,
      events,
      pricing,
      schoolHolidays,
      reportType,
      generatedAt: new Date().toISOString()
    };

    try {
      await global.db.query(
        'UPDATE analyses SET analysis_data = $1 WHERE id = $2',
        [JSON.stringify(analysisData), analysisId]
      );
    } catch(e) {}

    res.json({ analysisId, analysis: analysisData });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyze/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await global.db.query(
      'SELECT * FROM analyses WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ analysis: result.rows[0].analysis_data, status: result.rows[0].payment_status });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

function getSchoolHolidays() {
  return {
    europe: [
      { country: 'France', holidays: [
        { name: 'Vacances de Printemps', start: '2026-04-18', end: '2026-05-04', impact: 35 },
        { name: 'Grandes Vacances', start: '2026-07-04', end: '2026-09-01', impact: 45 },
        { name: 'Toussaint', start: '2026-10-17', end: '2026-11-02', impact: 30 }
      ]},
      { country: 'Espagne', holidays: [
        { name: 'Semana Santa', start: '2026-03-28', end: '2026-04-05', impact: 40 },
        { name: 'Verano', start: '2026-06-20', end: '2026-09-15', impact: 50 }
      ]},
      { country: 'Royaume-Uni', holidays: [
        { name: 'Easter Holiday', start: '2026-04-04', end: '2026-04-19', impact: 38 },
        { name: 'Summer Holiday', start: '2026-07-20', end: '2026-09-07', impact: 55 }
      ]},
      { country: 'Allemagne', holidays: [
        { name: 'Osterferien', start: '2026-03-28', end: '2026-04-11', impact: 32 },
        { name: 'Sommerferien', start: '2026-06-27', end: '2026-08-08', impact: 48 }
      ]},
      { country: 'Italie', holidays: [
        { name: 'Pasqua', start: '2026-04-04', end: '2026-04-12', impact: 35 },
        { name: 'Estate', start: '2026-06-13', end: '2026-09-13', impact: 45 }
      ]},
      { country: 'Belgique', holidays: [
        { name: 'Conges de Printemps', start: '2026-04-11', end: '2026-04-26', impact: 28 },
        { name: 'Grandes Vacances', start: '2026-07-01', end: '2026-08-31', impact: 42 }
      ]},
      { country: 'Pays-Bas', holidays: [
        { name: 'Meivakantie', start: '2026-04-25', end: '2026-05-10', impact: 30 },
        { name: 'Zomervakantie', start: '2026-07-04', end: '2026-08-16', impact: 44 }
      ]},
      { country: 'Suisse', holidays: [
        { name: 'Vacances de Paques', start: '2026-04-09', end: '2026-04-26', impact: 33 },
        { name: 'Grandes Vacances', start: '2026-07-04', end: '2026-08-16', impact: 40 }
      ]}
    ],
    america: [
      { country: 'USA', holidays: [
        { name: 'Spring Break', start: '2026-03-14', end: '2026-03-28', impact: 42 },
        { name: 'Summer', start: '2026-06-08', end: '2026-09-07', impact: 38 },
        { name: 'Thanksgiving', start: '2026-11-25', end: '2026-11-30', impact: 25 }
      ]},
      { country: 'Canada', holidays: [
        { name: 'Spring Break', start: '2026-03-14', end: '2026-03-28', impact: 30 },
        { name: 'Summer', start: '2026-06-27', end: '2026-09-07', impact: 35 }
      ]}
    ],
    gulf: [
      { country: 'Arabie Saoudite', holidays: [
        { name: 'Aid Al-Fitr', start: '2026-03-30', end: '2026-04-03', impact: 55 },
        { name: 'Aid Al-Adha', start: '2026-06-06', end: '2026-06-11', impact: 60 }
      ]},
      { country: 'Emirats Arabes Unis', holidays: [
        { name: 'Aid Al-Fitr', start: '2026-03-30', end: '2026-04-03', impact: 52 },
        { name: 'Aid Al-Adha', start: '2026-06-06', end: '2026-06-11', impact: 58 }
      ]}
    ]
  };
}

module.exports = router;
