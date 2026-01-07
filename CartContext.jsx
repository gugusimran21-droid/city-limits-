// src/CartContext/CartContext.jsx
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getToppingsForSize } from '../utils/toppingHelpers';

const CartContext = createContext();

/* ---------- Helpers ---------- */
function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function getItemUnitPrice(item) {
  if (!item) return 0;
  if (typeof item.price === 'number' && Number.isFinite(item.price)) return item.price;
  if (item.price !== undefined && item.price !== null) {
    const p = safeNumber(item.price);
    if (p > 0) return p;
  }
  if (typeof item.basePrice === 'number' && Number.isFinite(item.basePrice)) return item.basePrice;
  if (item.basePrice !== undefined && item.basePrice !== null) {
    const p = safeNumber(item.basePrice);
    if (p > 0) return p;
  }
  if (Array.isArray(item.sizes) && item.sizes.length) {
    const selectedSizeLabel = item.selectedSize || item.size || item.chosenSize || null;
    if (selectedSizeLabel) {
      const found = item.sizes.find(s => s.size === selectedSizeLabel || s._id === selectedSizeLabel);
      if (found && (found.basePrice !== undefined && found.basePrice !== null)) return safeNumber(found.basePrice);
    }
    const numericPrices = item.sizes.map(s => safeNumber(s.basePrice)).filter(n => n > 0);
    if (numericPrices.length) return Math.min(...numericPrices);
  }
  return 0;
}

// Identifies a locally-created cart line id (created when backend isn't used)
function isLocalCartId(id) {
  return typeof id === 'string' && id.includes('::');
}

/* ---------- Reducer ---------- */
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'HYDRATE_CART':
      return action.payload || [];
    case 'ADD_ITEM': {
      const { _id, item, quantity } = action.payload;
      const exists = state.find(ci => ci._id === _id);
      if (exists) {
        return state.map(ci => (ci._id === _id ? { ...ci, quantity: ci.quantity + quantity } : ci));
      }
      return [...state, { _id, item, quantity }];
    }
    case 'UPDATE_ITEM': {
      const { _id, quantity } = action.payload;
      return state.map(ci => (ci._id === _id ? { ...ci, quantity } : ci));
    }
    case 'REMOVE_ITEM':
      return state.filter(ci => ci._id !== action.payload);
    case 'CLEAR_CART':
      return [];
    default:
      return state;
  }
};

const initializer = () => {
  try {
    return JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    return [];
  }
};

/* ---------- Provider ---------- */
export const CartProvider = ({ children }) => {
  const [cartItems, dispatch] = useReducer(cartReducer, [], initializer);

  // persist locally
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // hydrate from server if token exists
  useEffect(() => {
    const fetchCart = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        // no token — keep local cart only
        return;
      }
      try {
        const res = await axios.get('http://localhost:4000/api/cart', {
          withCredentials: true,
          headers: { Authorization: `Bearer ${token}` },
        });
        let payload = res?.data;
        if (payload && payload.success === true && payload.data !== undefined) payload = payload.data;
        dispatch({ type: 'HYDRATE_CART', payload });
      } catch (err) {
        // token invalid or other error — clear token if auth issue and keep local cart
        if (err.response?.status === 401 || err.response?.status === 403 || /invalid token/i.test(err?.response?.data?.message || '')) {
          localStorage.removeItem('authToken');
        } else {
          console.error('fetchCart error:', err);
        }
      }
    };
    fetchCart();
  }, []);

  /**
   * addToCart
   * - If no token, build local cart-line immediately (no network call).
   * - If token present, attempt API call; if API indicates failure/invalid token, fallback to local cart-line.
   */
  const addToCart = useCallback(async (item, qty, options = {}) => {
    const token = localStorage.getItem('authToken');
    const { selectedSize = null, selectedToppings = [] } = options;

    // If user not logged in, skip API entirely and build local cart-line
    if (!token) {
      const sizeObj = Array.isArray(item.sizes) ? item.sizes.find(s => s.size === selectedSize || s._id === selectedSize) : null;
      const basePrice = sizeObj ? safeNumber(sizeObj.basePrice) : safeNumber(item.price || item.basePrice);
      const toppingsCandidates = getToppingsForSize(item, selectedSize);
      const resolvedToppings = toppingsCandidates
        .filter(t => selectedToppings.includes(t.name) || (t._id && selectedToppings.includes(t._id)))
        // preserve null when price not available; only convert when present
        .map(t => ({ name: t.name, _id: t._id, price: t.price != null ? safeNumber(t.price) : null }));
      const toppingsKey = resolvedToppings.map(t => `${t.name}:${t.price}`).join(',');
      const lineId = `${item._id}::${selectedSize || ''}::${toppingsKey}`;
      const cartLine = {
        _id: lineId,
        item: {
          ...item,
          selectedSize: selectedSize || null,
          basePrice,
          chosenToppings: resolvedToppings
        },
        quantity: qty
      };
      dispatch({ type: 'ADD_ITEM', payload: cartLine });
      return;
    }

    // Token exists — attempt API
    const apiPayload = { itemId: item._id, quantity: qty, size: selectedSize, toppings: selectedToppings };
    try {
      const res = await axios.post('http://localhost:4000/api/cart', apiPayload, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` }
      });

      // normalize response
      let returned = res?.data;
      if (returned && returned.success === true && returned.data !== undefined) returned = returned.data;
      if (!returned || res?.data?.success === false) {
        const msg = res?.data?.message || 'Add to cart failed';
        if (/token/i.test(msg)) localStorage.removeItem('authToken');
        throw new Error(msg);
      }

      // Enrich returned cart-line with chosen size/toppings for consistent UI
      let newLine = returned;
      if (selectedSize || (selectedToppings && selectedToppings.length)) {
        const sizeObj = Array.isArray(item.sizes) ? item.sizes.find(s => s.size === selectedSize || s._id === selectedSize) : null;
        const basePrice = sizeObj ? safeNumber(sizeObj.basePrice) : safeNumber(item.price || item.basePrice);
        const toppingsCandidates = getToppingsForSize(item, selectedSize);
        const resolvedToppings = toppingsCandidates
          .filter(t => selectedToppings.includes(t.name) || (t._id && selectedToppings.includes(t._id)))
          .map(t => ({ name: t.name, _id: t._id, price: t.price != null ? safeNumber(t.price) : null }));

        newLine = {
          ...returned,
          item: {
            ...returned.item,
            selectedSize: selectedSize || null,
            basePrice,
            chosenToppings: resolvedToppings
          }
        };
      }

      dispatch({ type: 'ADD_ITEM', payload: newLine });
      return;
    } catch (err) {
      // on auth error clear token and fallback to local
      const errMsg = err?.response?.data?.message || err?.message || '';
      if (err.response?.status === 401 || err.response?.status === 403 || /invalid token/i.test(errMsg)) {
        localStorage.removeItem('authToken');
      }
      console.warn('addToCart API failed; falling back to local cart. err:', errMsg);

      const sizeObj = Array.isArray(item.sizes) ? item.sizes.find(s => s.size === selectedSize || s._id === selectedSize) : null;
      const basePrice = sizeObj ? safeNumber(sizeObj.basePrice) : safeNumber(item.price || item.basePrice);
      const toppingsCandidates = getToppingsForSize(item, selectedSize);
      const resolvedToppings = toppingsCandidates
        .filter(t => selectedToppings.includes(t.name) || (t._id && selectedToppings.includes(t._id)))
        .map(t => ({ name: t.name, _id: t._id, price: t.price != null ? safeNumber(t.price) : null }));
      const toppingsKey = resolvedToppings.map(t => `${t.name}:${t.price}`).join(',');
      const lineId = `${item._id}::${selectedSize || ''}::${toppingsKey}`;
      const cartLine = {
        _id: lineId,
        item: {
          ...item,
          selectedSize: selectedSize || null,
          basePrice,
          chosenToppings: resolvedToppings
        },
        quantity: qty
      };
      dispatch({ type: 'ADD_ITEM', payload: cartLine });
    }
  }, []);

  /**
   * updateQuantity
   * - If _id is a local id or no token, update locally only.
   * - Otherwise, attempt server update and fall back to local update.
   */
  const updateQuantity = useCallback(async (_id, qty) => {
    // local-only update if id belongs to local fallback
    if (isLocalCartId(_id) || !localStorage.getItem('authToken')) {
      dispatch({ type: 'UPDATE_ITEM', payload: { _id, quantity: qty } });
      return;
    }

    const token = localStorage.getItem('authToken');
    try {
      const res = await axios.put(`http://localhost:4000/api/cart/${_id}`, { quantity: qty }, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` }
      });
      let returned = res?.data;
      if (returned && returned.success === true && returned.data !== undefined) returned = returned.data;
      if (!returned) {
        dispatch({ type: 'UPDATE_ITEM', payload: { _id, quantity: qty } });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM', payload: returned });
    } catch (err) {
      // fallback to local update
      console.warn('updateQuantity API failed, updating locally:', err?.message || err);
      dispatch({ type: 'UPDATE_ITEM', payload: { _id, quantity: qty } });
      if (err.response?.status === 401 || err.response?.status === 403) localStorage.removeItem('authToken');
    }
  }, []);

  /**
   * removeFromCart
   * - If local id or no token, remove locally only.
   * - Otherwise attempt server delete; always remove locally so UI is responsive.
   */
  const removeFromCart = useCallback(async _id => {
    if (isLocalCartId(_id) || !localStorage.getItem('authToken')) {
      dispatch({ type: 'REMOVE_ITEM', payload: _id });
      return;
    }

    const token = localStorage.getItem('authToken');
    try {
      await axios.delete(`http://localhost:4000/api/cart/${_id}`, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.warn('removeFromCart API failed:', err?.message || err);
      if (err.response?.status === 401 || err.response?.status === 403) localStorage.removeItem('authToken');
    } finally {
      // always remove locally for UX
      dispatch({ type: 'REMOVE_ITEM', payload: _id });
    }
  }, []);

  const clearCart = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      dispatch({ type: 'CLEAR_CART' });
      return;
    }
    try {
      await axios.post('http://localhost:4000/api/cart/clear', {}, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.warn('clearCart API failed:', err?.message || err);
      if (err.response?.status === 401 || err.response?.status === 403) localStorage.removeItem('authToken');
    } finally {
      dispatch({ type: 'CLEAR_CART' });
    }
  }, []);

  const totalItems = cartItems.reduce((sum, ci) => sum + (ci.quantity || 0), 0);

  const totalAmount = cartItems.reduce((sum, ci) => {
    const unitBase = safeNumber(ci.item?.basePrice ?? getItemUnitPrice(ci.item));
    // treat null topping price as 0 for totals but keep stored value as null in chosenToppings
    const toppingsSum = (ci.item?.chosenToppings || []).reduce((s, t) => s + safeNumber(t.price), 0);
    const qty = ci.quantity || 0;
    return sum + (unitBase + toppingsSum) * qty;
  }, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      totalItems,
      totalAmount
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);