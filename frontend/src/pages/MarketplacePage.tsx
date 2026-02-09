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
  Container,
} from '@mui/material';
import {
  AddShoppingCart,
  Search,
  FilterList,
  Verified,
  Storefront,
  ContactMail,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface MarketListing {
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
    district?: string;
    location?: string;
    isVerified: boolean;
  };
}

export const MarketplacePage = () => {
  const { isAuthenticated, hasRole } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterCrop, setFilterCrop] = useState('');

  // Fetch listings using the public API
  const { data: response, isLoading } = useQuery({
    queryKey: ['market-listings', filterCrop, filterRegion],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCrop) params.append('crop', filterCrop);
      if (filterRegion) params.append('region', filterRegion);

      const res = await api.get<{ listings: MarketListing[], totalCount: number, hasMore: boolean }>(
        `/api/market-listings?${params.toString()}`
      );
      return res.data;
    },
  });

  const listings = response?.listings || [];

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

  const handleContactSeller = (cooperativeId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    // Launch chat with the cooperative
    // In a real implementation, we would open the chat widget with this user selected
    // For now, let's just show a message or navigate to messages
    setSnackbar({
      open: true,
      message: 'Starting chat with seller...',
      severity: 'success',
    });
    // Logic to trigger chat widget to open with specific user would go here
    // For now, the user can use the chat widget manually
  };

  // Client-side filtering for search query (in addition to server-side filters)
  const filteredListings = listings.filter(
    (listing) =>
      listing.crop.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.cooperative.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.cooperative.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header Section */}
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Digital Marketplace
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse verified produce directly from cooperatives. Secure contracts, transparent pricing.
          </Typography>
        </Box>

        {/* Filters and Search */}
        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <TextField
              fullWidth
              size="small"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button variant="outlined" startIcon={<FilterList />}>
              Filters
            </Button>
            {/* Additional filters for Crop and Region could be added here as Dropdowns */}
          </Stack>
        </Card>

        {/* Listings Grid */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : !filteredListings.length ? (
          <Alert severity="info" icon={<Storefront fontSize="inherit" />}>
            No active listings found matching your criteria.
          </Alert>
        ) : (
          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }}
            gap={3}
          >
            {filteredListings.map((listing) => (
              <Card
                key={listing.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
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
                    <Storefront fontSize="small" color="action" />
                    <Typography variant="body2" fontWeight={600}>
                      {listing.cooperative.name}
                    </Typography>
                    {listing.cooperative.isVerified && (
                      <Tooltip title="Verified Cooperative">
                        <Verified sx={{ fontSize: 16, color: 'success.main' }} />
                      </Tooltip>
                    )}
                  </Stack>

                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    {listing.cooperative.region} {listing.cooperative.district ? `· ${listing.cooperative.district}` : ''}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" paragraph sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    height: '2.5em'
                  }}>
                    {listing.description || 'No description provided.'}
                  </Typography>

                  <Stack spacing={1} mt="auto">
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Available:</Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {listing.quantityKg.toLocaleString()} kg
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Price:</Typography>
                      <Typography variant="h6" fontWeight={700} color="success.main">
                        {listing.minimumPrice.toLocaleString()} RWF/kg
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<ContactMail />}
                    onClick={() => handleContactSeller(listing.cooperative.id)}
                  >
                    Contact
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    startIcon={<AddShoppingCart />}
                    onClick={() => handleAddToCart(listing.id, 50)} // Default amount
                  >
                    Add
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}
      </Stack>

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
    </Container>
  );
};
