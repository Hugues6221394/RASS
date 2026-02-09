import { Box, Card, CardContent, CardHeader, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { MarketPrice } from '../types';

export const PricesPage = () => {
  const { data: prices } = useQuery({
    queryKey: ['marketprices'],
    queryFn: async () => (await api.get<MarketPrice[]>('/api/marketprices')).data,
  });

  return (
    <Stack px={{ xs: 2, md: 6 }} py={4} spacing={2}>
      <Typography variant="h5" fontWeight={800}>
        AI-Powered Price Forecasting (live feeds)
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Latest submissions from market agents; forecasting hooks ready to connect to ML service.
      </Typography>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }} gap={2}>
        {prices?.map((p) => (
          <Card variant="outlined" key={p.id}>
            <CardHeader title={p.crop} subheader={p.market} />
            <CardContent>
              <Typography variant="h6" fontWeight={800}>
                {p.pricePerKg} RWF/kg
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Observed: {new Date(p.observedAt).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Forecast stub: hook to Prophet/TFT service later.
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      {!prices?.length && <Typography variant="body2">No market prices yet.</Typography>}
    </Stack>
  );
};

