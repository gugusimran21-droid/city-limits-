// src/utils/priceHelpers.js
export function computeUnitPriceForSelection(item, selectedSize = null, selectedToppings = []) {
  const safeNumber = x => { const n = Number(x); return Number.isFinite(n) ? n : 0; };

  let basePrice = 0;
  if (selectedSize && Array.isArray(item.sizes) && item.sizes.length) {
    const sizeObj = item.sizes.find(s => s.size === selectedSize || String(s._id) === String(selectedSize));
    basePrice = sizeObj ? safeNumber(sizeObj.basePrice) : safeNumber(item.price);
  } else {
    basePrice = safeNumber(item.price);
  }

  const toppingsSum = (selectedToppings || []).reduce((s, t) => s + safeNumber(t.price || t?.price), 0);
  return Number((basePrice + toppingsSum));
}