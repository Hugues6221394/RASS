import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography, Card, CardContent } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export const DashboardPage = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to role-specific dashboard
    if (hasRole('Farmer')) {
      navigate('/farmer-dashboard');
    } else if (hasRole('CooperativeManager')) {
      navigate('/cooperative-dashboard');
    } else if (hasRole('Buyer')) {
      navigate('/buyer-dashboard');
    } else if (hasRole('Transporter')) {
      navigate('/transporter-dashboard');
    } else if (hasRole('Admin')) {
      navigate('/admin');
    }
  }, [hasRole, navigate]);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, maxWidth: 400, textAlign: 'center' }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Welcome to RASS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Redirecting you to your dashboard...
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

