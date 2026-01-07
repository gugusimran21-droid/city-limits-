// src/components/Product/ProductDetailModal.jsx
import React from 'react';
import { getToppingsForSize } from '../../utils/toppingHelpers';

// Props:
// - product: product object
// - onClose(): close the modal
// - onConfirm(selectedSizeLabel, selectedToppingsArray): called when user confirms
export default function ProductDetailModal({ product, onClose, onConfirm }) {
  // If product has sizes, default to first size. Otherwise null (base-price)
  const initialSize = product?.sizes?.[0]?.size || product?.sizes?.[0]?._id || null;
  const [selectedSize, setSelectedSize] = React.useState(initialSize);
  const [selectedToppings, setSelectedToppings] = React.useState([]);

  // Get toppings normalized for this product and selected size.
  const toppingsForSize = getToppingsForSize(product, selectedSize);

  const base = (() => {
    const sizeObj = (product?.sizes || []).find(s => s.size === selectedSize || s._id === selectedSize);
    if (sizeObj && sizeObj.basePrice !== undefined && sizeObj.basePrice !== null) return Number(sizeObj.basePrice || 0);
    return Number(product?.basePrice ?? product?.price ?? 0);
  })();

  const toggleTopping = key => {
    setSelectedToppings(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]));
  };

  const toppingsTotal = selectedToppings.reduce((sum, tkey) => {
    const t = toppingsForSize.find(tt => tt.name === tkey || tt._id === tkey);
    return sum + (t && t.price != null ? Number(t.price) : 0);
  }, 0);

  const hasUnknownToppingPrice = selectedToppings.some(tkey => {
    const t = toppingsForSize.find(tt => tt.name === tkey || tt._id === tkey);
    return t && t.price == null;
  });

  const total = base + toppingsTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white/95 p-6 rounded-xl max-w-lg w-full text-black overflow-auto shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">{product?.name}</h2>
          <button onClick={onClose} className="text-sm px-2 py-1">Close</button>
        </div>

        {/* Size selector (if present) */}
        {product?.sizes && product.sizes.length > 0 && (
          <div className="mb-4">
            <label className="block font-semibold mb-2">Choose size</label>
            <select value={selectedSize || ''} onChange={(e) => setSelectedSize(e.target.value)} className="w-full p-2 rounded border">
              {product.sizes.map(s => (
                <option key={s._id || s.size} value={s.size ?? s._id}>
                  {s.size ?? s.label ?? 'Size'} — ₹{Number(s.basePrice || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Toppings */}
        <div className="mb-4">
          <label className="block font-semibold mb-2">Toppings</label>
          {toppingsForSize.length === 0 ? (
            <div className="text-sm text-gray-600">No toppings available</div>
          ) : (
            toppingsForSize.map(t => {
              const price = t.price != null ? Number(t.price) : null;
              const priceLabel = price === null ? '(Price unavailable)' : (price > 0 ? `(+₹${price.toFixed(2)})` : '(Free)');
              return (
                <label key={t._id ?? t.name} className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedToppings.includes(t.name) || selectedToppings.includes(t._id)}
                    onChange={() => toggleTopping(t.name)}
                  />
                  <span>{t.name} <span className="text-amber-400 ml-1 text-sm">{priceLabel}</span></span>
                </label>
              );
            })
          )}
        </div>

        {/* Price breakdown */}
        <div className="mb-4">
          <div className="flex justify-between"><span>Base price</span><span>₹{Number(base).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Toppings</span><span>₹{toppingsTotal.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
          {hasUnknownToppingPrice && (
            <div className="mt-2 text-sm text-yellow-700">
              Note: Some selected toppings don't have a recorded price — final order price may differ.
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
          <button onClick={() => onConfirm(selectedSize, selectedToppings)} className="px-4 py-2 rounded bg-amber-600 text-white">Add to cart</button>
        </div>
      </div>
    </div>
  );
}