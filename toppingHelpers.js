// src/utils/toppingHelpers.js
export function safeNumber(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }

// Recursively search an object for the first numeric value > 0 (depth-limited)
function findAnyNumeric(obj, depth = 3) {
  if (depth <= 0 || obj == null) return null;
  if (typeof obj === 'number') return safeNumber(obj) || null;
  if (typeof obj === 'string') {
    const n = Number(obj);
    if (Number.isFinite(n)) return safeNumber(n) || null;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const el of obj) {
      const v = findAnyNumeric(el, depth - 1);
      if (v !== null) return v;
    }
    return null;
  }
  if (typeof obj === 'object') {
    const commonKeys = ['price', 'amount', 'cost', 'value', 'price_inr', 'priceRs', 'rate', 'default'];
    for (const k of commonKeys) {
      if (obj[k] !== undefined) {
        const v = findAnyNumeric(obj[k], depth - 1);
        if (v !== null) return v;
      }
    }
    for (const key of Object.keys(obj)) {
      const v = findAnyNumeric(obj[key], depth - 1);
      if (v !== null) return v;
    }
  }
  return null;
}

function normalizeToppingsArray(arr = [], sizeLabel = null){
  if (!Array.isArray(arr)) return [];
  return arr.map(t => {
    if (!t) return null;

    // 1) direct price field
    if (t.price !== undefined && t.price !== null) return { name: t.name || '', price: safeNumber(t.price), _id: t._id };

    // 2) prices as ARRAY: [{size, price}] or [{key, value}]
    if (Array.isArray(t.prices)) {
      const p = sizeLabel ? t.prices.find(pp => pp.size === sizeLabel || pp.size === String(sizeLabel)) : null;
      if (p && p.price !== undefined && p.price !== null) return { name: t.name || '', price: safeNumber(p.price), _id: t._id };
      const anyNum = findAnyNumeric(t.prices, 2);
      if (anyNum !== null) return { name: t.name || '', price: anyNum, _id: t._id };
    }

    // 3) pricePerSize array
    if (Array.isArray(t.pricePerSize)) {
      const p = sizeLabel ? t.pricePerSize.find(pp => pp.size === sizeLabel) : null;
      if (p && p.price !== undefined && p.price !== null) return { name: t.name || '', price: safeNumber(p.price), _id: t._id };
      const anyNum = findAnyNumeric(t.pricePerSize, 2);
      if (anyNum !== null) return { name: t.name || '', price: anyNum, _id: t._id };
    }

    // 4) prices as OBJECT map: { '9"':50, default: 20 } or {} maybe empty
    if (t.prices && typeof t.prices === 'object' && !Array.isArray(t.prices)) {
      if (sizeLabel && t.prices[sizeLabel] !== undefined && t.prices[sizeLabel] !== null) return { name: t.name || '', price: safeNumber(t.prices[sizeLabel]), _id: t._id };
      if (t.prices.default !== undefined && t.prices.default !== null) return { name: t.name || '', price: safeNumber(t.prices.default), _id: t._id };
      const numericValues = Object.values(t.prices).map(v => safeNumber(v)).filter(v => v > 0);
      if (numericValues.length) return { name: t.name || '', price: Math.min(...numericValues), _id: t._id };
      // empty map -> unknown price
      return { name: t.name || '', price: null, _id: t._id };
    }

    // 5) pricesObj pattern
    if (t.pricesObj && typeof t.pricesObj === 'object' && sizeLabel && t.pricesObj[sizeLabel] !== undefined && t.pricesObj[sizeLabel] !== null) {
      return { name: t.name || '', price: safeNumber(t.pricesObj[sizeLabel]), _id: t._id };
    }

    // 6) catch-all: find any numeric anywhere inside the topping object
    const anyNum = findAnyNumeric(t, 2);
    if (anyNum !== null) return { name: t.name || '', price: anyNum, _id: t._id };

    // 7) fallback: return topping with price null (unknown)
    return { name: t.name || '', price: null, _id: t._id };
  }).filter(Boolean);
}

/**
 * Try to read a price value for a given topping key from a product-level price map.
 * Accepts numeric, object keyed by size, or nested shapes.
 */
function lookupFromProductMap(map, toppingKey, sizeLabel = null) {
  if (!map || typeof map !== 'object') return null;
  // direct by _id or name
  const candidates = [toppingKey, String(toppingKey)];
  for (const k of candidates) {
    if (map[k] !== undefined && map[k] !== null) {
      const v = map[k];
      if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))) return safeNumber(v);
      if (typeof v === 'object') {
        if (sizeLabel && v[sizeLabel] !== undefined && v[sizeLabel] !== null) return safeNumber(v[sizeLabel]);
        if (v.default !== undefined && v.default !== null) return safeNumber(v.default);
        const any = findAnyNumeric(v, 2);
        if (any !== null) return any;
      }
    }
  }
  // if map has a single numeric value (e.g., { "Ham": {}, "Green": 25 } or top-level numeric)
  const numericValues = Object.values(map).map(v => {
    if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))) return safeNumber(v);
    if (typeof v === 'object') {
      if (sizeLabel && v[sizeLabel] !== undefined && v[sizeLabel] !== null) return safeNumber(v[sizeLabel]);
      if (v.default !== undefined && v.default !== null) return safeNumber(v.default);
      const any = findAnyNumeric(v, 2);
      if (any !== null) return any;
    }
    return null;
  }).filter(v => v !== null && v > 0);
  if (numericValues.length) return Math.min(...numericValues);
  return null;
}

export function getToppingsForSize(product = {}, sizeLabel = null) {
  if (!product || typeof product !== 'object') return [];

  // 1) size-specific toppings (sizes[].toppings)
  if (Array.isArray(product.sizes) && sizeLabel) {
    const sizeObj = product.sizes.find(s => s.size === sizeLabel || s._id === sizeLabel);
    if (sizeObj) {
      const fromSize = normalizeToppingsArray(sizeObj.toppings || sizeObj.extras || sizeObj.options || [], sizeLabel);
      if (fromSize.length) return fromSize;
    }
  }

  // 2) top-level toppings (product.toppings / extras / options / addons)
  const topLevel = product.toppings || product.extras || product.options || product.addons || [];
  let normalized = [];
  if (Array.isArray(topLevel) && topLevel.length) {
    normalized = normalizeToppingsArray(topLevel, sizeLabel);
  }

  // 3) If normalized toppings present, try to enrich unknown prices from product-level price maps
  // (useful for base-size items where admin stored topping prices at product level)
  const productMaps = [
    product.toppingPrices, product.toppingPriceMap, product.toppingsPrice,
    product.toppingsPrices, product.topping_price_map, product.topping_price, product.priceMap
  ];
  if (normalized.length) {
    const enriched = normalized.map(t => {
      if (t.price != null) return t; // already known
      for (const map of productMaps) {
        const pv = lookupFromProductMap(map, t._id ?? t.name, sizeLabel);
        if (pv != null) return { ...t, price: pv };
      }
      return t;
    });
    return enriched;
  }

  // 4) product.toppingPrices map (create list from map if top-level toppings not present)
  for (const mapName of ['toppingPrices','toppingPriceMap','toppingsPrice','toppingsPrices','topping_price_map','topping_price','priceMap']) {
    const map = product[mapName];
    if (map && typeof map === 'object') {
      const out = [];
      for (const [name, priceObj] of Object.entries(map)) {
        let price = null;
        // if priceObj is numeric or string numeric
        if (typeof priceObj === 'number' || (typeof priceObj === 'string' && !isNaN(Number(priceObj)))) {
          price = safeNumber(priceObj);
        } else if (typeof priceObj === 'object') {
          if (sizeLabel && priceObj[sizeLabel] !== undefined && priceObj[sizeLabel] !== null) price = safeNumber(priceObj[sizeLabel]);
          else if (priceObj.default !== undefined && priceObj.default !== null) price = safeNumber(priceObj.default);
          else price = findAnyNumeric(priceObj, 2);
        }
        out.push({ name, price: price != null ? price : null });
      }
      if (out.length) return out;
    }
  }

  // 5) fallback: if sizes exist but toppings missing price: return toppings with null price
  if (Array.isArray(product.sizes) && sizeLabel) {
    const sizeObj = product.sizes.find(s => s.size === sizeLabel || s._id === sizeLabel);
    if (sizeObj && Array.isArray(sizeObj.toppings)) {
      return sizeObj.toppings.map(t => ({ name: t.name || '', price: t.price !== undefined && t.price !== null ? safeNumber(t.price) : null, _id: t._id }));
    }
  }

  // if we got normalized (possibly empty) return it
  return normalized;
}