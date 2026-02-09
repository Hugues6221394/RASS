import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export const Hero = () => {
  return (
    <Box
      sx={{
        background: 'linear-gradient(120deg, rgba(27,156,94,0.85), rgba(16,101,61,0.85)), url(https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80)',
        backgroundSize: 'cover',
        color: '#fff',
        borderRadius: 3,
        p: { xs: 3, md: 6 },
        mb: 4,
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h3" fontWeight={800}>
          Rwanda Agri Stability System
        </Typography>
        <Typography variant="h6" maxWidth="700px">
          Stabilizing prices, empowering farmers, connecting markets with real-time data, logistics and AI-guided price signals.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button component={RouterLink} to="/marketplace" variant="contained" color="secondary">
            Find Products
          </Button>
          <Button component={RouterLink} to="/logistics" variant="outlined" color="inherit">
            Join as Transporter
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

