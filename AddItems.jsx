import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { FiUpload, FiHeart, FiStar } from 'react-icons/fi';
import AdminNavbar from '../Navbar/Navbar';
import { styles } from '../../assets/dummyadmin';

const AddItems = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    rating: 0,
    hearts: 0,
    image: null,
    preview: '',
    sizes: [
      { size: '9"', basePrice: '' },
      { size: '12"', basePrice: '' },
      { size: '16"', basePrice: '' },
    ],
    // toppings entries will be either:
    // - sizes mode: { name, type, prices: { '9"': 0, '12"': 0, '16"': 0 } }
    // - base mode:  { name, type, price: 0 }
    toppings: [],
  });

  const [categories] = useState([
    'CLASSIC PIZZA MENU',
    'ALL-TIME FAVOURITE',
    'SPECIALITY MENU',
    'CREATE YOUR OWN',
    'CALZON',
    'GARLIC FINGERS',
    'DONAIRS',
    'NACHOS',
    'WINGETTES',
  ]);

  const [vegToppings] = useState(['Pepperoni', 'Ham', 'Salami', 'Ground Beef','Sausage', 'Bacon', 'Chicken','Philly Steak', 'Donair Meat']);
  const [nonVegToppings] = useState(['Red Onion', 'Green Pepper', 'Mushroom', 'Tomato', 'Black Olives', 'Pineapple', 'Hot Banana Peppers', 'Jalapeno Peppers']);
  const [hoverRating, setHoverRating] = useState(0);

  // Derived flags: which mode the admin is using
  const hasSizePrices = useMemo(
    () => formData.sizes.some(s => String(s.basePrice).trim() !== ''),
    [formData.sizes]
  );
  const hasBasePrice = String(formData.price).trim() !== '';

  // Keep basePrice as a string while editing so typing works
  const handleSizePriceChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.map((s, i) => (i === index ? { ...s, basePrice: value } : s))
    }));
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = e => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file,
        preview: URL.createObjectURL(file)
      }));
    }
  };

  // When mode toggles (hasSizePrices changes), convert existing toppings to the appropriate shape.
  // - If switching to base mode: take the first non-empty size price as topping.price (or 0)
  // - If switching to sizes mode: create prices map using existing topping.price for each size (or 0)
  useEffect(() => {
    setFormData(prev => {
      const newToppings = prev.toppings.map(t => {
        if (hasSizePrices) {
          // ensure prices map exists for each size
          const prices = {};
          prev.sizes.forEach(s => {
            const key = s.size;
            if (t.prices && t.prices[key] !== undefined) prices[key] = t.prices[key];
            else if (t.price !== undefined) prices[key] = t.price;
            else prices[key] = 0;
          });
          return { name: t.name, type: t.type, prices };
        } else {
          // base mode: pick first numeric size price if present, else existing price or 0
          let derived = 0;
          if (t.prices && typeof t.prices === 'object') {
            for (const k of Object.keys(t.prices)) {
              const v = Number(t.prices[k]);
              if (!Number.isNaN(v)) { derived = v; break; }
            }
          }
          if (t.price !== undefined && t.price !== null) derived = Number(t.price);
          return { name: t.name, type: t.type, price: derived };
        }
      });
      return { ...prev, toppings: newToppings };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSizePrices]); // run when hasSizePrices changes

  // Toggle topping selection (add/remove). When adding, create default per-size prices or single price.
  const handleToppingToggle = (type, name) => {
    setFormData(prev => {
      const exists = prev.toppings.find(t => t.name === name);
      if (exists) {
        // remove topping
        return { ...prev, toppings: prev.toppings.filter(t => t.name !== name) };
      }
      // build default prices using current mode
      if (hasSizePrices) {
        const defaultPrices = {};
        (prev.sizes || []).forEach(s => {
          defaultPrices[s.size] = 0;
        });
        const topping = { name, type, prices: defaultPrices };
        return { ...prev, toppings: [...prev.toppings, topping] };
      } else {
        const topping = { name, type, price: 0 };
        return { ...prev, toppings: [...prev.toppings, topping] };
      }
    });
  };

  // Remove topping by index/name (used in UI)
  const handleRemoveTopping = (tIdx) => {
    setFormData(prev => ({
      ...prev,
      toppings: prev.toppings.filter((_, idx) => idx !== tIdx)
    }));
  };

  const handleRating = rating => setFormData(prev => ({ ...prev, rating }));
  const handleHearts = () => setFormData(prev => ({ ...prev, hearts: prev.hearts + 1 }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Decide mode:
    if (hasSizePrices) {
      // validate all sizes have valid numeric basePrice
      const invalidSize = formData.sizes.some(s => s.basePrice === '' || Number.isNaN(Number(s.basePrice)));
      if (invalidSize) {
        alert('Please enter a valid numeric price for every pizza size or clear all size prices to use base price mode.');
        return;
      }
    } else {
      if (!hasBasePrice) {
        alert('Please provide either a base price OR prices for pizza sizes.');
        return;
      }
    }

    try {
      const payload = new FormData();
      payload.append('name', formData.name);
      payload.append('description', formData.description);
      payload.append('category', formData.category);

      // If sizes mode, send sizes; otherwise send the base price
      if (hasSizePrices) {
        const sizesPayload = formData.sizes.map(s => ({
          size: s.size,
          basePrice: Number(s.basePrice)
        }));
        payload.append('sizes', JSON.stringify(sizesPayload));
      } else {
        payload.append('price', String(Number(formData.price)));
      }

      payload.append('rating', String(formData.rating));
      payload.append('hearts', String(formData.hearts));
      if (formData.image) payload.append('image', formData.image);

      // build toppings payload according to current mode
      let toppingsPayload;
      if (hasSizePrices) {
        toppingsPayload = formData.toppings.map(t => ({
          name: t.name,
          type: t.type,
          // ensure numeric values for all sizes
          prices: Object.fromEntries(Object.entries(t.prices || {}).map(([k,v]) => [k, Number(v ?? 0)]))
        }));
      } else {
        // base-mode: send a single price field per topping
        toppingsPayload = formData.toppings.map(t => ({
          name: t.name,
          type: t.type,
          price: Number(t.price ?? 0)
        }));
      }
      payload.append('toppings', JSON.stringify(toppingsPayload));

      // debug logs (FormData can't be logged directly)
      console.log('Submitting item; mode:', hasSizePrices ? 'sizes' : 'price');
      if (hasSizePrices) console.log('sizes:', formData.sizes);
      else console.log('price:', formData.price);
      console.log('toppingsPayload', toppingsPayload);

      await axios.post('http://localhost:4000/api/items', payload);

      alert('Item added successfully!');

      // reset form after successful submission
      setFormData({
        name: '',
        description: '',
        category: '',
        price: '',
        rating: 0,
        hearts: 0,
        image: null,
        preview: '',
        sizes: [
          { size: '9"', basePrice: '' },
          { size: '12"', basePrice: '' },
          { size: '16"', basePrice: '' },
        ],
        toppings: [],
      });
    } catch (err) {
      console.error('Error uploading item:', err.response?.data || err.message);
      alert('Failed to add item. See console for details.');
    }
  };

  return (
    <>
      <AdminNavbar />
      <div className={styles.formWrapper}>
        <div className="max-w-4xl mx-auto">
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Add New Menu Item</h2>
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              {/* Image Upload */}
              <div className={styles.uploadWrapper}>
                <label className={styles.uploadLabel}>
                  {formData.preview ? (
                    <img src={formData.preview} alt="Preview" className={styles.previewImage} />
                  ) : (
                    <div className="text-center p-4">
                      <FiUpload className={styles.uploadIcon} />
                      <p className={styles.uploadText}>Click to upload product image</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" required />
                </label>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block mb-2 text-base sm:text-lg text-amber-400">Product Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className={styles.inputField} placeholder="Enter product name" required />
                </div>

                <div>
                  <label className="block mb-2 text-base sm:text-lg text-amber-400">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} className={styles.inputField + ' h-32 sm:h-40'} placeholder="Enter product description" required />
                </div>

                <div className={styles.gridTwoCols}>
                  <div>
                    <label className="block mb-2 text-base sm:text-lg text-amber-400">Category</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} className={styles.inputField} required>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c} value={c} className="bg-[#3a2b2b]">{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-base sm:text-lg text-amber-400">Base Price (use if you don't want different size prices)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} className={styles.inputField} placeholder="Enter base price" required={!hasSizePrices} disabled={hasSizePrices} />
                  {hasSizePrices && <p className="text-sm text-amber-300 mt-1">Disabled because you entered at least one size price. Clear the size prices to enable.</p>}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-amber-400">Pizza Sizes (fill any to enable sizes mode)</h3>
                  {formData.sizes.map((size, index) => (
                    <div key={index} className="flex gap-4 mt-2 items-center">
                      <p className='text-amber-300 w-24'>{size.size} Price:</p>
                      <input type="number" name={`size-${index}`} placeholder={`Enter price for ${size.size} pizza`} value={size.basePrice ?? ''} onChange={(e) => handleSizePriceChange(index, e.target.value)} className={styles.inputField} disabled={hasBasePrice} />
                    </div>
                  ))}
                  {hasBasePrice && <p className="text-sm text-amber-300 mt-1">Disabled because a base price is set. Clear base price to enable size-specific prices.</p>}
                </div>

                {/* toppings */}
                <div>
                  <h3 className="text-lg sm:text-xl text-amber-400 mt-4">Veg Toppings</h3>
                  <div className="flex flex-wrap gap-4">
                    {vegToppings.map(topping => (
                      <label key={topping} className="flex gap-2 items-center">
                        <input type="checkbox" checked={formData.toppings.some(t => t.name === topping)} onChange={() => handleToppingToggle('veg', topping)} />
                        <span className="text-amber-300">{topping}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl text-amber-400 mt-4">Non-Veg Toppings</h3>
                  <div className="flex flex-wrap gap-4">
                    {nonVegToppings.map(topping => (
                      <label key={topping} className="flex gap-2 items-center">
                        <input type="checkbox" checked={formData.toppings.some(t => t.name === topping)} onChange={() => handleToppingToggle('non-veg', topping)} />
                        <span className="text-amber-300">{topping}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Toppings price editor */}
                {formData.toppings.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-lg sm:text-xl text-amber-400">Selected Toppings (set prices)</h3>
                    <div className="flex flex-col gap-3 mt-2">
                      {formData.toppings.map((topping, tIdx) => (
                        <div key={topping.name} className="p-2 border rounded bg-[#1f1b1b]">
                          <div className="flex items-center justify-between">
                            <div className="text-amber-300 font-medium">{topping.name}</div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTopping(tIdx)}
                              className="text-sm text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="flex gap-3 mt-2 flex-wrap">
                            {hasSizePrices ? (
                              // per-size inputs
                              formData.sizes.map((s) => (
                                <label key={s.size} className="flex flex-col items-start">
                                  <span className="text-sm text-amber-200">{s.size}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={topping.prices?.[s.size] ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormData(prev => ({
                                        ...prev,
                                        toppings: prev.toppings.map((tp, idx) =>
                                          idx === tIdx ? { ...tp, prices: { ...tp.prices, [s.size]: val } } : tp
                                        )
                                      }));
                                    }}
                                    className="w-24 p-1 rounded bg-[#2a2323] text-amber-100"
                                  />
                                </label>
                              ))
                            ) : (
                              // single price input for base-mode
                              <label className="flex flex-col items-start">
                                <span className="text-sm text-amber-200">Topping Price (base)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={topping.price ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({
                                      ...prev,
                                      toppings: prev.toppings.map((tp, idx) =>
                                        idx === tIdx ? { ...tp, price: val } : tp
                                      )
                                    }));
                                  }}
                                  className="w-32 p-1 rounded bg-[#2a2323] text-amber-100"
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.gridTwoCols}>
                  <div>
                    <label className="block mb-2 text-base sm:text-lg text-amber-400">Rating</label>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} type="button" onClick={() => handleRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="text-2xl sm:text-3xl transition-transform hover:scale-110">
                          <FiStar className={star <= (hoverRating || formData.rating) ? 'text-amber-400 fill-current' : 'text-amber-100/30'} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 text-base sm:text-lg text-amber-400">Popularity</label>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <button type="button" onClick={handleHearts} className="text-2xl sm:text-3xl text-amber-400 hover:text-amber-300 transition-colors animate-pulse"><FiHeart/></button>
                      <input type="number" name="hearts" value={formData.hearts} onChange={handleInputChange} className={styles.inputField + ' pl-10 sm:pl-12'} placeholder="Enter Likes" min="0" required />
                    </div>
                  </div>
                </div>

                <button type="submit" className={styles.actionBtn}>Add to Menu</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddItems;