import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TrackingInfo } from '../types';

export const TrackingPage = () => {
  const [trackingId, setTrackingId] = useState('RASS-123456');

  const trackingMutation = useMutation({
    mutationFn: async (id: string) => (await api.get<TrackingInfo>(`/api/tracking/${id}`)).data,
  });

  const handleTrack = () => {
    if (!trackingId) return;
    trackingMutation.mutate(trackingId);
  };

  const tracking = trackingMutation.data;

  return (
    <Box px={{ xs: 2, md: 6 }} py={4}>
      <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={800}>
              Track your shipment or contract
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Tracking ID" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} />
              <Button variant="contained" onClick={handleTrack} disabled={trackingMutation.isPending}>
                Track
              </Button>
            </Stack>
            {trackingMutation.isError && <Alert severity="error">Not found.</Alert>}
            {tracking && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {tracking.trackingId} · {tracking.status}
                  </Typography>
                  <Typography variant="body2">Order: {tracking.order.crop} · {tracking.order.market}</Typography>
                  <Typography variant="body2">
                    Delivery window: {new Date(tracking.order.deliveryWindowStart).toLocaleDateString()} -{' '}
                    {new Date(tracking.order.deliveryWindowEnd).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" mt={1} fontWeight={700}>
                    Transport
                  </Typography>
                  <Stack spacing={0.5}>
                    {tracking.transports.map((t, idx) => (
                      <Typography variant="body2" key={idx}>
                        {t.origin} → {t.destination} | {t.status} | Truck: {t.assignedTruck ?? 'TBD'}
                      </Typography>
                    ))}
                  </Stack>
                  <Typography variant="body2" mt={1} fontWeight={700}>
                    Storage
                  </Typography>
                  <Stack spacing={0.5}>
                    {tracking.storage.map((s, idx) => (
                      <Typography variant="body2" key={idx}>
                        {s.facility} | {s.status} | {new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}
                      </Typography>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

