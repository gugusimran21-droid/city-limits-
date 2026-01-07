import React, { useState, useEffect, useRef } from 'react';
import { FiUser, FiBox } from 'react-icons/fi';
import axios from 'axios';
import AdminNavbar from '../Navbar/Navbar';
import { io } from 'socket.io-client';
import {
  statusStyles,
  paymentMethodDetails,
  tableClasses,
  layoutClasses,
  iconMap
} from '../../assets/dummyadmin';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false); // Track if the alarm is playing

  // 🔊 SOUND REFS (UPDATED)
  const prevOrderCount = useRef(0);
  const audioRef = useRef(null);

  // 🔊 PLAY ALARM FUNCTION 
  const playAlarm = () => {
    const sound =
      localStorage.getItem('adminSound') || '/sounds/alarm.wav';

    if (!audioRef.current) {
      audioRef.current = new Audio(sound);
      audioRef.current.loop = true; // Enable looping
    }
    
    //play the audio
    audioRef.current 
    .play()
    .then(() => 
    {
      setIsPlaying(true);// Update state to reflect playing status
     })
     .catch(err => {
        console.error('Error playing sound:', err);
      });
  };

  // 🔇 STOP ALARM FUNCTION
  const stopAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0; // Reset audio to the beginning
      setIsPlaying(false); // Update state to reflect stopped status
    }
  };

    // 🚨 LOCALSTORAGE EVENT LISTENER FOR CROSS-TAB NOTIFICATIONS
 useEffect(() => {
    // Handle storage updates
    const handleStorageUpdate = (event) => {
      if (event.key === 'newOrderDetected') {
        playAlarm(); // Play alarm when a new order is detected
        console.log('Cross-tab new order alarm triggered.');
      }
    };

    // Attach listener for 'storage' events
    window.addEventListener('storage', handleStorageUpdate);

    // Cleanup when component is unmounted
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  // 🚀 WEBSOCKET CONNECTION
  useEffect(() => {
    const socket = io('http://localhost:4000'); // Connect to backend WebSocket server

    // Listen for "newOrder" events from server
    socket.on('newOrder', () => {
      console.log('WebSocket event "newOrder" received.'); // Debugging (optional)
      playAlarm(); // Play alarm when a new order arrives
    });

    // Cleanup the WebSocket connection on component unmount
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axios.get(
          'http://localhost:4000/api/orders/getall',
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        const formatted = response.data.map(order => ({
          ...order,
          address: order.address ?? order.shippingAddress?.address ?? '',
          city: order.city ?? order.shippingAddress?.city ?? '',
          zipCode: order.zipCode ?? order.shippingAddress?.zipCode ?? '',
          phone: order.phone ?? '',
          items:
            order.items?.map(e => ({
              _id: e._id,
              item: e.item,
              quantity: e.quantity,
            })) || [],
          createdAt: new Date(order.createdAt).toLocaleDateString(
            'en-IN',
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }
          ),
        }));

        // 🔔 NEW ORDER DETECTION (ADDED, SAFE)
        setOrders((prevOrders) => {
          if (prevOrders.length > 0 && formatted.length > prevOrders.length) {
            playAlarm();//automatically play the alarm on new orders
            if (document.hidden) notifyNewOrder(); // Play notification only if user is NOT on the current page
          
           // Notify other tabs of the new order using localStorage
            localStorage.setItem('newOrderDetected', Date.now().toString()); 
          }
          prevOrderCount.current = formatted.length;
          return formatted;
        });
        

        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load orders.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // 🚨 NOTIFICATION FUNCTION
  const notifyNewOrder = () => {
    const title = 'New Order Received!';
    const options = {
      body: 'You have a new order in the system.',
      icon: '/icons/order-icon.png', // Optional icon for notification
    };

    if (Notification.permission === 'granted') {
      new Notification(title, options);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission(permission => {
        if (permission === 'granted') {
          new Notification(title, options);
        }
      });
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.put(
        `http://localhost:4000/api/orders/getall/${orderId}`,
        { status: newStatus }
      );
      setOrders((orders)=>
        orders.map((o) =>
          (o._id === orderId ? { ...o, status: newStatus } : o
        ))
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update order status');
    }
  };

  if (loading){
    return (
      <div className={layoutClasses.page + ' flex items-center justify-center'}>
        <div className="text-amber-400 text-xl">Loading orders...</div>
      </div>
    );
  }
  if (error){
    return (
      <div className={layoutClasses.page + ' flex items-center justify-center'}>
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    );
  }


  return (
    <>
      <AdminNavbar />
      <div className={layoutClasses.page}>
        <div className="max-w-7xl mx-auto">
          <div className={layoutClasses.card}>
            <h2 className={layoutClasses.heading}>Order Management</h2>

            {/* 🔊 SOUND CONTROLS */}
            <div className="flex flex-wrap gap-4 mb-6">
              <button
                onClick={playAlarm}
                className="px-4 py-2 bg-amber-500 text-black rounded-lg font-medium"
                disabled={isPlaying} // Disable if already playing
              >
                Enable Order Sound 🔊
              </button>

              <button
                onClick={stopAlarm}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium"
                disabled={!isPlaying} // Disable the button if not currently playing
              >
                Stop Order Sound 🔇
              </button>

              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  localStorage.setItem('adminSound', url);
                  alert('Custom order sound saved!');
                }}
                className="text-amber-200"
              />
            </div>

            <div className={tableClasses.wrapper}>
              <table className={tableClasses.table}>
                <thead className={tableClasses.headerRow}>
                  <tr>
                    {[
                      'Order ID',
                      'Customer',
                      'Address',
                      'Items',
                      'Total Items',
                      'Price',
                      'Payment',
                      'Status',
                    ].map(h => (
                      <th
                        key={h}
                        className={
                          tableClasses.headerCell +
                          (h === 'Total Items' ? ' text-center' : '')
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const totalItems = order.items.reduce(
                      (s, i) => s + i.quantity,
                      0
                    );
                    const totalPrice =
                      order.total ??
                      order.items.reduce(
                        (s, i) => s + i.item.price * i.quantity,
                        0
                      );
                    const payMethod =
                      paymentMethodDetails[
                        order.paymentMethod?.toLowerCase()
                      ] || paymentMethodDetails.default;
                    const payStatusStyle =
                      statusStyles[order.paymentStatus] ||
                      statusStyles.processing;
                    const stat =
                      statusStyles[order.status] ||
                      statusStyles.processing;

                    return (
                      <tr key={order._id} className={tableClasses.row}>
                        <td
                          className={
                            tableClasses.cellBase +
                            ' font-mono text-sm text-amber-100'
                          }
                        >
                          #{order._id.slice(-8)}
                        </td>

                        <td className={tableClasses.cellBase}>
                          <div className="flex items-center gap-2">
                            <FiUser className="text-amber-400" />
                            <div>
                              <p className="text-amber-100">
                                {order.user?.name ||
                                  order.firstName +
                                    ' ' +
                                    order.lastName}
                              </p>
                              <p className="text-sm text-amber-400/60">
                                {order.user?.phone || order.phone}
                              </p>
                              <p className="text-sm text-amber-400/60">
                                {order.user?.email || order.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className={tableClasses.cellBase}>
                          <div className="text-amber-100/80 text-sm max-w-[200px]">
                            {order.address}, {order.city} -{' '}
                            {order.zipCode}
                          </div>
                        </td>

                        <td className={tableClasses.cellBase}>
                          <div className="space-y-1 max-h-52 overflow-auto">
                            {order.items.map((itm, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 p-2 rounded-lg"
                              >
                                <img
                                  src={`http://localhost:4000${itm.item.imageUrl}`}
                                  alt={itm.item.name}
                                  className="w-10 h-10 object-cover rounded-lg"
                                />
                                <div className="flex-1">
                                  <span className="text-amber-100/80 text-sm block truncate">
                                    {itm.item.name}
                                  </span>
                                  <div className="flex items-center gap-2 text-xs text-amber-400/60">
                                    <span>
                                      ₹{itm.item.price.toFixed(2)}
                                    </span>
                                    <span>•</span>
                                    <span>x{itm.quantity}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td
                          className={
                            tableClasses.cellBase + ' text-center'
                          }
                        >
                          <div className="flex items-center justify-center gap-1">
                            <FiBox className="text-amber-400" />
                            <span className="text-amber-300 text-lg">
                              {totalItems}
                            </span>
                          </div>
                        </td>

                        <td
                          className={
                            tableClasses.cellBase +
                            ' text-amber-300 text-lg'
                          }
                        >
                          ₹{totalPrice.toFixed(2)}
                        </td>

                        <td className={tableClasses.cellBase}>
                          <div className="flex flex-col gap-2">
                            <div
                              className={`${payMethod.class} px-3 py-1.5 rounded-lg border text-sm`}
                            >
                              {payMethod.label}
                            </div>
                            <div
                              className={`${payStatusStyle.color} flex items-center gap-2 text-sm`}
                            >
                              {iconMap[payStatusStyle.icon]}
                              <span>{payStatusStyle.label}</span>
                            </div>
                          </div>
                        </td>

                        <td className={tableClasses.cellBase}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`${stat.color} text-xl`}
                            >
                              {iconMap[stat.icon]}
                            </span>
                            <select
                              value={order.status}
                              onChange={e =>
                                handleStatusChange(
                                  order._id,
                                  e.target.value
                                )
                              }
                              className={`px-4 py-2 rounded-lg ${stat.bg} ${stat.color} border border-amber-500/20 text-sm cursor-pointer`}
                            >
                              {Object.entries(statusStyles)
                                .filter(([k]) => k !== 'succeeded')
                                .map(([key, sty]) => (
                                  <option
                                    key={key}
                                    value={key}
                                    className={`${sty.bg} ${sty.color}`}
                                  >
                                    {sty.label}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {orders.length === 0 && (
              <div className="text-center py-12 text-amber-100/60 text-xl">
                No orders found
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Orders;
