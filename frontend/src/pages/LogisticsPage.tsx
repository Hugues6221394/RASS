import { Box, Card, CardContent, CardHeader, Chip, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { StorageFacility, TransportRequest } from '../types';

export const LogisticsPage = () => {
  const { data: transports } = useQuery({
    queryKey: ['transport'],
    queryFn: async () => (await api.get<TransportRequest[]>('/api/transport')).data,
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => (await api.get<StorageFacility[]>('/api/storage/facilities')).data,
  });

  return (
    <Stack px={{ xs: 2, md: 6 }} py={4} spacing={3}>
      <Typography variant="h5" fontWeight={800}>
        Smart Logistics & Storage
      </Typography>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} gap={2}>
        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
          <CardHeader title="Transport Requests" subheader="Optimized routes, pooled loads" />
          <CardContent>
            <Stack spacing={1}>
              {transports?.map((t) => (
                <Card key={t.id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={700}>
                        {t.origin} → {t.destination}
                      </Typography>
                      <Chip label={t.status} color="success" size="small" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {t.loadKg} kg · Pickup {new Date(t.pickupStart).toLocaleString()} - {new Date(t.pickupEnd).toLocaleString()}
                    </Typography>
                    <Typography variant="body2">Truck: {t.assignedTruck ?? 'Assigning'}</Typography>
                  </CardContent>
                </Card>
              ))}
              {!transports?.length && <Typography variant="body2">No transport requests yet.</Typography>}
            </Stack>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
          <CardHeader title="Storage Facilities" subheader="Book capacity in real time" />
          <CardContent>
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
              {facilities?.map((f) => (
                <Card variant="outlined" key={f.id}>
                  <CardContent>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={700}>{f.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {f.location}
                      </Typography>
                      <Typography variant="body2">
                        Available: {(f.availableKg / 1000).toLocaleString()} tons / {(f.capacityKg / 1000).toLocaleString()} tons
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {f.features?.slice(0, 3).map((feat) => (
                          <Chip key={feat} label={feat} size="small" />
                        ))}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {!facilities?.length && <Typography variant="body2">No storage listed.</Typography>}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
};

