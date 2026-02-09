import { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    IconButton,
    Stack,
    TextField,
    Divider,
    Alert,
    CircularProgress,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import {
    Delete,
    ShoppingCartCheckout,
    RemoveShoppingCart,
    Add,
    Remove,
} from '@mui/icons-material';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

export const CartPage = () => {
    const { items, total, loading, removeFromCart, updateQuantity, clearCart, checkout } = useCart();
    const navigate = useNavigate();
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [deliveryStart, setDeliveryStart] = useState<Date | null>(new Date());
    const [deliveryEnd, setDeliveryEnd] = useState<Date | null>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutSuccess, setCheckoutSuccess] = useState(false);

    const handleQuantityChange = async (itemId: string, currentQty: number, delta: number) => {
        const newQty = Math.max(1, currentQty + delta);
        await updateQuantity(itemId, newQty);
    };

    const handleCheckout = async () => {
        if (!deliveryLocation || !deliveryStart || !deliveryEnd) return;

        setCheckoutLoading(true);
        try {
            await checkout(deliveryLocation, deliveryStart, deliveryEnd);
            setCheckoutSuccess(true);
            setCheckoutOpen(false);
            setTimeout(() => {
                navigate('/buyer');
            }, 2000);
        } catch (error) {
            console.error('Checkout failed:', error);
        } finally {
            setCheckoutLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (checkoutSuccess) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="h6">Order placed successfully!</Typography>
                    <Typography>Redirecting to your dashboard...</Typography>
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight={700}>
                    Shopping Cart
                </Typography>
                {items.length > 0 && (
                    <Button
                        color="error"
                        startIcon={<RemoveShoppingCart />}
                        onClick={clearCart}
                    >
                        Clear Cart
                    </Button>
                )}
            </Stack>

            {items.length === 0 ? (
                <Card sx={{ p: 4, textAlign: 'center' }}>
                    <RemoveShoppingCart sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        Your cart is empty
                    </Typography>
                    <Button variant="contained" onClick={() => navigate('/')}>
                        Browse Marketplace
                    </Button>
                </Card>
            ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
                    {/* Cart Items */}
                    <Stack spacing={2}>
                        {items.map((item) => (
                            <Card key={item.id}>
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Box flex={1}>
                                            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                                                <Typography variant="h6" fontWeight={600}>
                                                    {item.listing.crop}
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label={`Grade ${item.listing.qualityGrade}`}
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                From: {item.listing.cooperative.name} ({item.listing.cooperative.region})
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Unit Price: {item.listing.minimumPrice.toLocaleString()} RWF/kg
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Available: {item.listing.availableQuantity.toLocaleString()} kg
                                            </Typography>
                                        </Box>

                                        <Stack alignItems="flex-end" spacing={1}>
                                            <IconButton
                                                color="error"
                                                size="small"
                                                onClick={() => removeFromCart(item.id)}
                                            >
                                                <Delete />
                                            </IconButton>

                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleQuantityChange(item.id, item.quantityKg, -10)}
                                                    disabled={item.quantityKg <= 10}
                                                >
                                                    <Remove />
                                                </IconButton>
                                                <Typography variant="body1" fontWeight={600} sx={{ minWidth: 60, textAlign: 'center' }}>
                                                    {item.quantityKg} kg
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleQuantityChange(item.id, item.quantityKg, 10)}
                                                    disabled={item.quantityKg >= item.listing.availableQuantity}
                                                >
                                                    <Add />
                                                </IconButton>
                                            </Stack>

                                            <Typography variant="h6" color="primary.main" fontWeight={700}>
                                                {item.subtotal.toLocaleString()} RWF
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>

                    {/* Order Summary */}
                    <Card sx={{ position: 'sticky', top: 20, height: 'fit-content' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight={600} gutterBottom>
                                Order Summary
                            </Typography>
                            <Divider sx={{ my: 2 }} />

                            <Stack spacing={1}>
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography color="text.secondary">Items</Typography>
                                    <Typography>{items.length}</Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography color="text.secondary">Total Quantity</Typography>
                                    <Typography>{items.reduce((sum, i) => sum + i.quantityKg, 0).toLocaleString()} kg</Typography>
                                </Stack>
                            </Stack>

                            <Divider sx={{ my: 2 }} />

                            <Stack direction="row" justifyContent="space-between" mb={3}>
                                <Typography variant="h6" fontWeight={600}>Total</Typography>
                                <Typography variant="h6" fontWeight={700} color="primary.main">
                                    {total.toLocaleString()} RWF
                                </Typography>
                            </Stack>

                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                startIcon={<ShoppingCartCheckout />}
                                onClick={() => setCheckoutOpen(true)}
                            >
                                Proceed to Checkout
                            </Button>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* Checkout Dialog */}
            <Dialog open={checkoutOpen} onClose={() => setCheckoutOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Complete Your Order</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            label="Delivery Location"
                            fullWidth
                            value={deliveryLocation}
                            onChange={(e) => setDeliveryLocation(e.target.value)}
                            placeholder="Enter delivery address"
                            required
                        />
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Delivery Window Start"
                                value={deliveryStart}
                                onChange={(date) => setDeliveryStart(date)}
                            />
                            <DatePicker
                                label="Delivery Window End"
                                value={deliveryEnd}
                                onChange={(date) => setDeliveryEnd(date)}
                            />
                        </LocalizationProvider>
                        <Alert severity="info">
                            Your order will be sent to the cooperatives for approval. You'll receive a notification once accepted.
                        </Alert>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCheckoutOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCheckout}
                        disabled={!deliveryLocation || !deliveryStart || !deliveryEnd || checkoutLoading}
                    >
                        {checkoutLoading ? <CircularProgress size={24} /> : 'Place Order'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
