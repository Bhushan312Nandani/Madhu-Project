// backend/routes/currency.js
import express from 'express';
const router = express.Router();

/**
 * MadhuShud Dynamic Currency & International Tariff Engine
 * Base Currency: PKR (Pakistani Rupee)
 *
 * Supported Target Currencies:
 * - USD (US Dollar)
 * - AED (UAE Dirham)
 * - SAR (Saudi Riyal)
 * - GBP (British Pound)
 * - EUR (Euro)
 */

// Exchange rates against 1 PKR (Updated regularly / market baseline)
// 1 USD ~ 278.5 PKR, 1 AED ~ 75.8 PKR, 1 SAR ~ 74.25 PKR, 1 GBP ~ 362.4 PKR, 1 EUR ~ 303.1 PKR
const EXCHANGE_RATES = {
  PKR: 1.0,
  USD: 1 / 278.50,
  AED: 1 / 75.80,
  SAR: 1 / 74.25,
  GBP: 1 / 362.40,
  EUR: 1 / 303.10,
};

const CURRENCY_SYMBOLS = {
  PKR: 'Rs.',
  USD: '$',
  AED: 'AED',
  SAR: 'SAR',
  GBP: '£',
  EUR: '€',
};

// International Tariffs:
// For international shipments of natural cold-pressed edible & cosmetic oils,
// an export duty, phytosanitary clearance, customs handling, and international
// payment gateway fee buffer of 14% is applied.
const INTL_EXPORT_DUTY_RATE = 0.14; // 14% international tax & tariff buffer

// International Freight Estimates (by region) in PKR
const SHIPPING_ZONES = {
  domestic: {
    name: 'Pakistan (Domestic)',
    ratePKR: 200,
    freeThresholdPKR: 1500,
    estimatedDays: '2 - 4 business days',
    courier: 'TCS / Leopards Express',
  },
  middleEast: {
    name: 'GCC / Middle East (UAE, Saudi Arabia, Oman, Qatar, Bahrain)',
    ratePKR: 3500,
    freeThresholdPKR: 25000,
    estimatedDays: '4 - 7 business days',
    courier: 'DHL / FedEx International Express',
  },
  ukEurope: {
    name: 'United Kingdom & Europe',
    ratePKR: 4800,
    freeThresholdPKR: 32000,
    estimatedDays: '5 - 9 business days',
    courier: 'DHL Express Worldwide',
  },
  northAmerica: {
    name: 'USA & Canada',
    ratePKR: 5800,
    freeThresholdPKR: 38000,
    estimatedDays: '6 - 10 business days',
    courier: 'FedEx International Priority',
  },
  restOfWorld: {
    name: 'Rest of the World',
    ratePKR: 6500,
    freeThresholdPKR: 45000,
    estimatedDays: '7 - 14 business days',
    courier: 'DHL / Aramex International',
  },
};

/**
 * GET /api/currency/rates
 * Returns available currencies, rates against PKR, international tax buffer, and symbols
 */
router.get('/rates', (req, res) => {
  res.json({
    success: true,
    baseCurrency: 'PKR',
    timestamp: new Date().toISOString(),
    rates: EXCHANGE_RATES,
    symbols: CURRENCY_SYMBOLS,
    intlTaxRate: INTL_EXPORT_DUTY_RATE,
    intlTaxPercentage: `${INTL_EXPORT_DUTY_RATE * 100}%`,
    shippingZones: SHIPPING_ZONES,
    contact: {
      phone: '03332529504',
      whatsapp: '+923332529504',
      whatsappFormatted: 'https://wa.me/923332529504',
      address: 'Sadique Faqeer Chowk, Mithi, Tharparkar, Sindh, Pakistan',
      email: 'madhuoil@gmail.com',
    },
  });
});

/**
 * POST /api/currency/convert
 * Converts PKR amount into target currency factoring in international tax/tariffs
 * Body: { amountPKR, targetCurrency, isInternational = false }
 */
router.post('/convert', (req, res) => {
  const { amountPKR, targetCurrency = 'PKR', isInternational = false } = req.body;

  const basePKR = Number(amountPKR) || 0;
  const target = (targetCurrency || 'PKR').toUpperCase();
  const rate = EXCHANGE_RATES[target] || 1.0;
  const symbol = CURRENCY_SYMBOLS[target] || target;

  // Calculate tariff
  const applyIntlTax = isInternational && target !== 'PKR';
  const taxAmountPKR = applyIntlTax ? Math.round(basePKR * INTL_EXPORT_DUTY_RATE) : 0;
  const totalPKR = basePKR + taxAmountPKR;

  // Convert to target currency
  const convertedBase = Number((basePKR * rate).toFixed(2));
  const convertedTax = Number((taxAmountPKR * rate).toFixed(2));
  const convertedTotal = Number((totalPKR * rate).toFixed(2));

  res.json({
    success: true,
    input: {
      amountPKR: basePKR,
      targetCurrency: target,
      isInternational: applyIntlTax,
    },
    conversion: {
      rate,
      symbol,
      basePKR,
      taxPKR: taxAmountPKR,
      totalPKR,
      convertedBase,
      convertedTax,
      convertedTotal,
      formattedTotal: `${symbol} ${convertedTotal.toLocaleString()}`,
    },
  });
});

export default router;
