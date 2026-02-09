import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  AddShoppingCart,
  ShoppingBag,
  Search,
  FilterList,
  Verified,
  TrendingUp,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Hero } from '../components/Hero';
import { StatCard } from '../components/StatCard';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { MarketPrice } from '../types';


interface FeaturedListing {
  id: string;
  crop: string;
  quantityKg: number;
  minimumPrice: number;
  qualityGrade: string;
  description: string;
  availabilityWindowStart: string;
  availabilityWindowEnd: string;
  cooperative: {
    id: string;
    name: string;
    region: string;
    isVerified: boolean;
  };
}

export const HomePage = () => {
  const { isAuthenticated, hasRole } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const { data: prices } = useQuery({
    queryKey: ['market-latest'],
    queryFn: async () => {
      const res = await api.get<MarketPrice[]>('/api/marketprices/latest');
      return res.data;
    },
  });

  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['featured-listings'],
    queryFn: async () => {
      const res = await api.get<FeaturedListing[]>('/api/market-listings/featured?count=8');
      return res.data;
    },
  });

  const handleAddToCart = async (listingId: string, quantityKg: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!hasRole('Buyer')) {
      setSnackbar({
        open: true,
        message: 'Only buyers can add items to cart. Please register as a buyer.',
        severity: 'error',
      });
      return;
    }
    try {
      await addToCart(listingId, quantityKg);
      setSnackbar({
        open: true,
        message: 'Added to cart successfully!',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to add to cart. Please try again.',
        severity: 'error',
      });
    }
  };

  const filteredListings = listings?.filter(
    (listing) =>
      listing.crop.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.cooperative.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.cooperative.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box px={{ xs: 2, md: 6 }} py={4}>
      <Hero />

      {/* Stats Section */}
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={2} mb={4}>
        <StatCard label="Price Volatility Reduction" value="70%" helper="Target from pilots" />
        <StatCard label="Cost Savings" value="40%" helper="Pooling & routing optimization" />
        <StatCard label="Truck Utilization" value="85%" helper="Load pooling & backhauls" />
        <StatCard label="Payment Time" value="<48h" helper="Escrow + verified delivery" />
      </Box>

      {/* Featured Listings Section */}
      <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 4 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2} mb={3}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ShoppingBag color="primary" />
                <Typography variant="h5" fontWeight={700}>
                  Featured Produce
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Fresh produce from verified cooperatives across Rwanda
              </Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Search by crop, cooperative, or region..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: 280 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          {listingsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : !filteredListings?.length ? (
            <Alert severity="info" sx={{ my: 2 }}>
              No produce listings available at the moment. Check back soon!
            </Alert>
          ) : (
            <Box
              display="grid"
              gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }}
              gap={2}
            >
              {filteredListings.map((listing) => (
                <Card
                  key={listing.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 3,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="h6" fontWeight={700} color="primary.main">
                        {listing.crop}
                      </Typography>
                      <Chip
                        size="small"
                        label={`Grade ${listing.qualityGrade}`}
                        color={listing.qualityGrade === 'A' ? 'success' : listing.qualityGrade === 'B' ? 'warning' : 'default'}
                      />
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={0.5} mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        {listing.cooperative.name}
                      </Typography>
                      {listing.cooperative.isVerified && (
                        <Tooltip title="Verified Cooperative">
                          <Verified sx={{ fontSize: 16, color: 'success.main' }} />
                        </Tooltip>
                      )}
                    </Stack>

                    <Typography variant="caption" color="text.disabled" display="block" mb={2}>
                      {listing.cooperative.region}
                    </Typography>

                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Available:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {listing.quantityKg.toLocaleString()} kg
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Price:
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="success.main">
                          {listing.minimumPrice.toLocaleString()} RWF/kg
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ pt: 0, px: 2, pb: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      startIcon={<AddShoppingCart />}
                      onClick={() => handleAddToCart(listing.id, 50)} // Default 50kg
                    >
                      Add to Cart
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/marketplace')}
              endIcon={<FilterList />}
            >
              View All Listings
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Live Prices Section */}
      <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={3}>
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <TrendingUp color="success" />
                <Typography variant="h6" fontWeight={800}>
                  Live Market Prices
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Real-time submissions from market agents across districts.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                {prices?.map((p) => (
                  <Chip key={p.id} label={`${p.market} · ${p.crop} · ${p.pricePerKg} RWF/kg`} color="success" variant="outlined" />
                ))}
                {!prices?.length && <Typography variant="body2">No price data yet.</Typography>}
              </Stack>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Modules working together:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {['Data Collection', 'AI Forecasting', 'Digital Marketplace', 'Smart Logistics', 'Transparency'].map((m) => (
                  <Chip key={m} label={m} color="primary" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
