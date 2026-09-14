// frontend/src/context/CurrencyContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const CurrencyContext = createContext();

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Fallback rates against 1 PKR if offline
const DEFAULT_RATES = {
  PKR: 1.0,
  USD: 1 / 278.50,
  AED: 1 / 75.80,
  SAR: 1 / 74.25,
  GBP: 1 / 362.40,
  EUR: 1 / 303.10,
};

const DEFAULT_SYMBOLS = {
  PKR: 'Rs.',
  USD: '$',
  AED: 'AED',
  SAR: 'SAR',
  GBP: '£',
  EUR: '€',
};

// 14% international export duty, phytosanitary, and customs clearance buffer
const DEFAULT_INTL_TAX = 0.14;

export const CONTACT_INFO = {
  phone: '03332529504',
  whatsapp: '+923332529504',
  whatsappFormatted: 'https://wa.me/923332529504',
  address: 'Sadique Faqeer Chowk, Mithi, Tharparkar, Sindh, Pakistan',
  email: 'madhuoil@gmail.com',
};

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    return localStorage.getItem('madhu_currency') || 'PKR';
  });
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
  const [intlTaxRate, setIntlTaxRate] = useState(DEFAULT_INTL_TAX);
  const [shippingZones, setShippingZones] = useState(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await axios.get(`${API}/currency/rates`);
        if (res.data?.rates) {
          setRates(res.data.rates);
          if (res.data.symbols) setSymbols(res.data.symbols);
          if (res.data.intlTaxRate) setIntlTaxRate(res.data.intlTaxRate);
          if (res.data.shippingZones) setShippingZones(res.data.shippingZones);
        }
      } catch {
        // Use default fallback rates
      }
    };
    fetchRates();
  }, []);

  const setCurrency = (curr) => {
    const upper = curr.toUpperCase();
    setCurrencyState(upper);
    localStorage.setItem('madhu_currency', upper);
  };

  /**
   * formatPrice(amountPKR, options)
   * Converts PKR amount into selected currency with optional international duty buffer
   */
  const formatPrice = useCallback((amountPKR, options = {}) => {
    const basePKR = Number(amountPKR) || 0;
    const { 
      includeIntlTax = true, 
      showSymbol = true,
      exactCurrency = null 
    } = options;

    const curr = exactCurrency || currency;
    const rate = rates[curr] || 1.0;
    const symbol = symbols[curr] || curr;

    if (curr === 'PKR') {
      const formatted = Math.round(basePKR).toLocaleString();
      return showSymbol ? `${symbol} ${formatted}` : formatted;
    }

    // International conversion: include export tariff/tax buffer
    const taxMultiplier = includeIntlTax ? (1 + intlTaxRate) : 1;
    const converted = (basePKR * rate * taxMultiplier);
    
    // Formatting: 2 decimal places for foreign currencies
    const formatted = converted >= 100 
      ? Math.round(converted).toLocaleString() 
      : converted.toFixed(2);

    return showSymbol ? `${symbol} ${formatted}` : formatted;
  }, [currency, rates, symbols, intlTaxRate]);

  /**
   * Helper to get raw numerical value in current currency
   */
  const getConvertedNumber = useCallback((amountPKR, includeIntlTax = true) => {
    const basePKR = Number(amountPKR) || 0;
    if (currency === 'PKR') return basePKR;
    const rate = rates[currency] || 1.0;
    const taxMultiplier = includeIntlTax ? (1 + intlTaxRate) : 1;
    return Number((basePKR * rate * taxMultiplier).toFixed(2));
  }, [currency, rates, intlTaxRate]);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        rates,
        symbols,
        intlTaxRate,
        shippingZones,
        contactInfo: CONTACT_INFO,
        formatPrice,
        getConvertedNumber,
        isInternational: currency !== 'PKR',
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
