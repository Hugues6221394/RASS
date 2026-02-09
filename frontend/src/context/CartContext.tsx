import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface CartItem {
    id: string;
    quantityKg: number;
    addedAt: string;
    listing: {
        id: string;
        crop: string;
        minimumPrice: number;
        qualityGrade: string;
        availableQuantity: number;
        cooperative: {
            id: string;
            name: string;
            region: string;
        };
    };
    subtotal: number;
}

interface CartContextType {
    items: CartItem[];
    itemCount: number;
    total: number;
    loading: boolean;
    addToCart: (listingId: string, quantityKg: number) => Promise<void>;
    removeFromCart: (itemId: string) => Promise<void>;
    updateQuantity: (itemId: string, quantityKg: number) => Promise<void>;
    clearCart: () => Promise<void>;
    checkout: (deliveryLocation: string, deliveryWindowStart: Date, deliveryWindowEnd: Date) => Promise<{ orderIds: string[] }>;
    refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

interface CartProviderProps {
    children: React.ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [itemCount, setItemCount] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const refreshCart = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/cart');
            setItems(response.data.items);
            setItemCount(response.data.itemCount);
            setTotal(response.data.total);
        } catch (error) {
            // If 401, user is not logged in - cart is empty
            console.log('Cart not available (user may not be logged in)');
            setItems([]);
            setItemCount(0);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshCart();
    }, [refreshCart]);

    const addToCart = async (listingId: string, quantityKg: number) => {
        setLoading(true);
        try {
            await api.post('/api/cart', { listingId, quantityKg });
            await refreshCart();
        } finally {
            setLoading(false);
        }
    };

    const removeFromCart = async (itemId: string) => {
        setLoading(true);
        try {
            await api.delete(`/api/cart/${itemId}`);
            await refreshCart();
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = async (itemId: string, quantityKg: number) => {
        setLoading(true);
        try {
            await api.put(`/api/cart/${itemId}`, { quantityKg });
            await refreshCart();
        } finally {
            setLoading(false);
        }
    };

    const clearCart = async () => {
        setLoading(true);
        try {
            await api.delete('/api/cart');
            setItems([]);
            setItemCount(0);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    const checkout = async (
        deliveryLocation: string,
        deliveryWindowStart: Date,
        deliveryWindowEnd: Date
    ) => {
        setLoading(true);
        try {
            const response = await api.post('/api/cart/checkout', {
                deliveryLocation,
                deliveryWindowStart: deliveryWindowStart.toISOString(),
                deliveryWindowEnd: deliveryWindowEnd.toISOString(),
            });
            await refreshCart();
            return { orderIds: response.data.orderIds };
        } finally {
            setLoading(false);
        }
    };

    return (
        <CartContext.Provider
            value={{
                items,
                itemCount,
                total,
                loading,
                addToCart,
                removeFromCart,
                updateQuantity,
                clearCart,
                checkout,
                refreshCart,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};
