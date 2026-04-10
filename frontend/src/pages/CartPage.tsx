import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { buildLocationText, emptyRwandaLocation } from '../utils/rwandaLocation';

export const CartPage = () => {
  const { t } = useTranslation();
  const { items, total, loading, removeFromCart, updateQuantity, clearCart, checkout } = useCart();
  const navigate = useNavigate();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [deliveryLocationForm, setDeliveryLocationForm] = useState(emptyRwandaLocation());
  const [deliveryStart, setDeliveryStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deliveryEnd, setDeliveryEnd] = useState<string>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const handleQuantityChange = async (itemId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(1, currentQty + delta);
    await updateQuantity(itemId, newQty);
  };

  const handleCheckout = async () => {
    const deliveryLocation = buildLocationText(deliveryLocationForm);
    if (!deliveryLocation || !deliveryStart || !deliveryEnd) return;

    setCheckoutLoading(true);
    try {
      await checkout(deliveryLocation, new Date(deliveryStart), new Date(deliveryEnd));
      setCheckoutSuccess(true);
      setCheckoutOpen(false);
      setTimeout(() => navigate('/buyer'), 2000);
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#D9EFE4] border-t-[#00793E] animate-spin" />
      </div>
    );
  }

  if (checkoutSuccess) {
    return (
      <div className="min-h-screen bg-[#F4FAF7] flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#003D20,#00793E)' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-[#0D1B12] mb-2">{t('cart.order_placed', 'Order Placed Successfully!')}</h2>
          <p className="text-[#4A6358]">{t('cart.redirecting', 'Redirecting to your dashboard…')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4FAF7]">

      {/* Header */}
      <div
        className="rass-page-hero"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="rass-page-hero-grid" />
        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 py-10 pb-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-base shadow-lg">🛒</div>
                <span className="text-green-200 text-xs font-semibold uppercase tracking-widest">Shopping</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 leading-tight">{t('cart.title', 'Your Cart')}</h1>
              <p className="text-green-100 text-base">{items.length} {items.length === 1 ? 'item' : 'items'} ready for checkout</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="rass-metric-chip">🔒 Secure checkout</span>
                <span className="rass-metric-chip">🚚 Fast delivery</span>
              </div>
            </div>
            {items.length > 0 && (
              <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}>
                <p className="text-green-200 text-xs font-semibold uppercase tracking-wider mb-1">Cart Total</p>
                <p className="text-3xl font-extrabold text-white">{(total / 1000).toFixed(0)}k</p>
                <p className="text-green-200/70 text-xs">RWF</p>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-[#F4FAF7]" style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 -mt-2 pb-10">

        {/* Clear cart button */}
        {items.length > 0 && (
          <div className="flex justify-end mb-4">
            <button onClick={clearCart} className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-sm font-semibold transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t('cart.clear_cart', 'Clear Cart')}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="card p-10 text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-[#EDF5F0] flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#9AAFA6]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0D1B12] mb-1">{t('cart.empty', 'Your cart is empty')}</h3>
            <p className="text-sm text-[#4A6358] mb-4">Browse the marketplace and add items to your cart</p>
            <button onClick={() => navigate('/')} className="btn btn-primary">
              {t('cart.browse_marketplace', 'Browse Marketplace')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="card p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-[#0D1B12] text-lg">{item.listing.crop}</h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EDF5F0] text-[#003D20]">
                          Grade {item.listing.qualityGrade}
                        </span>
                      </div>
                      <p className="text-sm text-[#4A6358]">
                        {t('cart.from', 'From')}: {item.listing.cooperative?.name ?? 'Unknown'} ({item.listing.cooperative?.region ?? 'Unknown'})
                      </p>
                      <p className="text-sm text-[#4A6358]">
                        {t('cart.unit_price', 'Unit price')}: {item.listing.minimumPrice?.toLocaleString() ?? 0} RWF/kg
                      </p>
                      <p className="text-sm text-[#4A6358]">
                        {t('common.available', 'Available')}: {item.listing.availableQuantity?.toLocaleString() ?? 0} kg
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      {/* Delete button */}
                      <button onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-600 p-1 rounded transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 bg-[#F4FAF7] rounded-xl px-2 py-1">
                        <button onClick={() => handleQuantityChange(item.id, item.quantityKg, -10)}
                          disabled={item.quantityKg <= 10}
                          className="w-7 h-7 rounded-lg bg-white border border-[#D9EFE4] flex items-center justify-center text-[#4A6358] hover:bg-[#EDF5F0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="min-w-[60px] text-center font-bold text-[#0D1B12] text-sm">{item.quantityKg} kg</span>
                        <button onClick={() => handleQuantityChange(item.id, item.quantityKg, 10)}
                          disabled={item.quantityKg >= (item.listing.availableQuantity ?? 0)}
                          className="w-7 h-7 rounded-lg bg-white border border-[#D9EFE4] flex items-center justify-center text-[#4A6358] hover:bg-[#EDF5F0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>

                      {/* Subtotal */}
                      <p className="text-lg font-extrabold text-[#003D20]">{item.subtotal?.toLocaleString() ?? 0} RWF</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="card p-5 sticky top-5">
                <h3 className="font-extrabold text-[#0D1B12] text-lg mb-4">{t('cart.order_summary', 'Order Summary')}</h3>

                <div className="border-t border-[#EDF5F0] pt-4 pb-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#4A6358]">{t('cart.items', 'Items')}</span>
                    <span className="font-semibold text-[#0D1B12]">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#4A6358]">{t('cart.total_quantity', 'Total Quantity')}</span>
                    <span className="font-semibold text-[#0D1B12]">{items.reduce((sum, i) => sum + i.quantityKg, 0).toLocaleString()} kg</span>
                  </div>
                </div>

                <div className="border-t border-[#EDF5F0] pt-4 pb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#0D1B12]">{t('common.total', 'Total')}</span>
                    <span className="text-xl font-extrabold text-[#003D20]">{total.toLocaleString()} RWF</span>
                  </div>
                </div>

                <button onClick={() => setCheckoutOpen(true)} className="btn btn-primary w-full flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  {t('cart.proceed_checkout', 'Proceed to Checkout')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setCheckoutOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-[#EDF5F0] flex items-center justify-between">
              <h2 className="font-extrabold text-[#0D1B12] text-lg">{t('cart.complete_order', 'Complete Your Order')}</h2>
              <button onClick={() => setCheckoutOpen(false)} className="text-[#9AAFA6] hover:text-[#4A6358]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal content */}
            <div className="px-6 py-5 space-y-4">
              <RwandaLocationFields
                value={deliveryLocationForm}
                onChange={setDeliveryLocationForm}
                showDetail
                detailLabel={t('common.delivery_location', 'Delivery Location')}
                detailPlaceholder={t('cart.delivery_placeholder', 'Building, warehouse gate, or delivery landmark')}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">{t('cart.delivery_start', 'Delivery Start')} *</label>
                  <input
                    type="date"
                    value={deliveryStart}
                    onChange={e => setDeliveryStart(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">{t('cart.delivery_end', 'Delivery End')} *</label>
                  <input
                    type="date"
                    value={deliveryEnd}
                    onChange={e => setDeliveryEnd(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="bg-blue-50 text-blue-700 text-sm rounded-xl p-3 flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>{t('cart.approval_notice', 'Your order will be reviewed and approved by the cooperative before processing.')}</p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-[#EDF5F0] flex justify-end gap-3">
              <button onClick={() => setCheckoutOpen(false)} className="btn">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleCheckout}
                disabled={!deliveryLocationForm.district || !deliveryLocationForm.sector || !deliveryStart || !deliveryEnd || checkoutLoading}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {checkoutLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Processing…
                  </span>
                ) : t('cart.place_order', 'Place Order')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
