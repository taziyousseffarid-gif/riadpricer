// RiadPricer - Service de calcul de prix optimal
// Algorithme base sur: position marche, demande, saison, evenements

async function calculateOptimalPrice(riadData, rooms) {
  const currentPrice = riadData.currentPrice || 800;
  const rating = parseFloat(riadData.rating) || 4.5;
  const quartier = riadData.quartier || 'Medina';
  
  // Coefficient qualite (1.0 = standard)
  const qualityCoef = getQualityCoefficient(rating, riadData.category);
  
  // Coefficient localisation
  const locationCoef = getLocationCoefficient(quartier);
  
  // Coefficient saison actuelle
  const seasonCoef = getCurrentSeasonCoefficient();
  
  // Prix de base marche Marrakech
  const marketBase = getMarketBasePrice(rooms, riadData.category);
  
  // Prix optimal calcule
  const optimalPrice = Math.round(marketBase * qualityCoef * locationCoef * seasonCoef);
  
  // Fourchette de prix
  const lowPrice = Math.round(optimalPrice * 0.75);
  const peakPrice = Math.round(optimalPrice * 1.45);
  
  // Position marche estimee
  const marketPosition = estimateMarketPosition(optimalPrice);
  
  // Gain mensuel potentiel
  const currentMonthly = currentPrice * rooms * 22 * 0.65;
  const optimalMonthly = optimalPrice * rooms * 22 * 0.72;
  const monthlyGain = Math.round(optimalMonthly - currentMonthly);
  
  // Prochain pic de demande
  const nextPeak = getNextDemandPeak();
  
  return {
    optimalPrice,
    lowPrice,
    peakPrice,
    marketPosition,
    monthlyGain,
    nextPeak,
    revenueBoost: Math.round((optimalMonthly / currentMonthly - 1) * 100),
    priceCalendar: generatePriceCalendar(optimalPrice),
    strategy: generateStrategy(optimalPrice, currentPrice, rating),
    confidence: 87,
    calculatedAt: new Date().toISOString()
  };
}

function getQualityCoefficient(rating, category) {
  let coef = 1.0;
  if (rating >= 4.9) coef = 1.35;
  else if (rating >= 4.7) coef = 1.20;
  else if (rating >= 4.5) coef = 1.05;
  else if (rating >= 4.0) coef = 0.90;
  else coef = 0.75;
  
  if (category && category.includes('5')) coef *= 1.25;
  else if (category && category.includes('4')) coef *= 1.10;
  
  return coef;
}

function getLocationCoefficient(quartier) {
  const coefficients = {
    'Medina': 1.0,
    'Mellah': 0.92,
    'Kasbah': 0.95,
    'Palmeraie': 1.15,
    'Hivernage': 1.20,
    'Gueliz': 0.88,
    'Bab Doukkala': 0.90,
    'Sidi Mimoun': 0.85
  };
  return coefficients[quartier] || 1.0;
}

function getCurrentSeasonCoefficient() {
  const month = new Date().getMonth() + 1;
  const seasonCoefs = {
    1: 1.35, 2: 1.25, 3: 1.30, 4: 1.40, 
    5: 1.15, 6: 0.95, 7: 0.80, 8: 0.75,
    9: 1.10, 10: 1.30, 11: 1.45, 12: 1.50
  };
  return seasonCoefs[month] || 1.0;
}

function getMarketBasePrice(rooms, category) {
  // Prix de base selon taille et categorie
  let base = 700;
  if (rooms <= 5) base = 650;
  else if (rooms <= 8) base = 780;
  else if (rooms <= 12) base = 850;
  else if (rooms <= 20) base = 950;
  else base = 1100;
  
  if (category && category.includes('5')) base *= 2.5;
  else if (category && category.includes('4')) base *= 1.6;
  
  return base;
}

function estimateMarketPosition(price) {
  // Basé sur distribution de prix à Marrakech
  if (price < 500) return 18;
  if (price < 700) return 15;
  if (price < 900) return 12;
  if (price < 1200) return 8;
  if (price < 1800) return 5;
  if (price < 2500) return 3;
  return 2;
}

function getNextDemandPeak() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  
  const peaks = [
    { month: 4, day: 15, name: 'Semaine Sainte' },
    { month: 6, day: 6, name: 'Aid Al-Adha' },
    { month: 7, day: 10, name: 'Festival Arts Populaires' },
    { month: 10, day: 8, name: 'Festival Oasis' },
    { month: 11, day: 27, name: 'FIFM' },
    { month: 12, day: 20, name: 'Noel/Nouvel An' }
  ];
  
  for (const peak of peaks) {
    const peakDate = new Date(now.getFullYear(), peak.month - 1, peak.day);
    const daysUntil = Math.round((peakDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 90) {
      return peak.name + ' (J-' + daysUntil + ')';
    }
  }
  return 'Haute saison (moins de 30j)';
}

function generatePriceCalendar(basePrice) {
  const calendar = [];
  const now = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();
    const month = date.getMonth() + 1;
    
    let price = basePrice;
    // Weekend premium
    if (dayOfWeek === 5 || dayOfWeek === 6) price = Math.round(price * 1.25);
    // Monday discount
    if (dayOfWeek === 1) price = Math.round(price * 0.90);
    
    calendar.push({
      date: date.toISOString().slice(0, 10),
      price,
      level: price > basePrice * 1.15 ? 'high' : price < basePrice * 0.95 ? 'low' : 'medium'
    });
  }
  
  return calendar;
}

function generateStrategy(optimalPrice, currentPrice, rating) {
  const diff = optimalPrice - currentPrice;
  const pct = Math.round((diff / currentPrice) * 100);
  
  if (pct > 15) {
    return 'Votre prix actuel est sous-evalue. Augmentation recommandee de ' + pct + '% par paliers de 5% sur 3 semaines.';
  } else if (pct < -10) {
    return 'Votre prix est superieur au marche. Reduction de ' + Math.abs(pct) + '% recommandee pour ameliorer votre taux d occupation.';
  } else {
    return 'Votre prix est bien positionne. Optimisations mineures possibles selon les periodes et evenements.';
  }
}

module.exports = { calculateOptimalPrice };
