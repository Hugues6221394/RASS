import { AppBar, Toolbar, Typography, Stack, Button } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { CartIcon } from './CartIcon';

export const NavBar = () => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardLink = () => {
    if (hasRole('Farmer')) return '/farmer-dashboard';
    if (hasRole('CooperativeManager')) return '/cooperative-dashboard';
    if (hasRole('Buyer')) return '/buyer-dashboard';
    if (hasRole('Transporter')) return '/transporter-dashboard';
    if (hasRole('Government')) return '/government-dashboard';
    if (hasRole('Admin')) return '/admin';
    return '/dashboard';
  };

  const getNavigationLinks = () => {
    const baseLinks = [{ label: 'Home', to: '/' }];

    if (!user) {
      return [
        ...baseLinks,
        { label: 'Price Forecasts', to: '/prices' },
        { label: 'AI Forecast', to: '/ai-forecast' },
        { label: 'Track Shipment', to: '/tracking' },
      ];
    }

    if (hasRole('Farmer')) {
      return [
        ...baseLinks,
        { label: 'My Dashboard', to: getDashboardLink() },
        { label: 'Market Prices', to: '/prices' },
        { label: 'AI Forecast', to: '/ai-forecast' },
      ];
    }

    if (hasRole('CooperativeManager')) {
      return [
        ...baseLinks,
        { label: 'My Dashboard', to: getDashboardLink() },
        { label: 'Marketplace', to: '/marketplace' },
        { label: 'AI Forecast', to: '/ai-forecast' },
      ];
    }

    if (hasRole('Buyer')) {
      return [
        ...baseLinks,
        { label: 'My Dashboard', to: getDashboardLink() },
        { label: 'Marketplace', to: '/marketplace' },
        { label: 'AI Forecast', to: '/ai-forecast' },
        { label: 'Track Shipment', to: '/tracking' },
      ];
    }

    if (hasRole('Transporter')) {
      return [
        ...baseLinks,
        { label: 'My Dashboard', to: getDashboardLink() },
        { label: 'Logistics', to: '/logistics' },
        { label: 'AI Forecast', to: '/ai-forecast' },
      ];
    }

    if (hasRole('Government')) {
      return [
        ...baseLinks,
        { label: 'Policy Dashboard', to: '/government-dashboard' },
        { label: 'AI Forecast', to: '/ai-forecast' },
      ];
    }

    if (hasRole('Admin')) {
      return [
        ...baseLinks,
        { label: 'Admin Dashboard', to: getDashboardLink() },
        { label: 'Marketplace', to: '/marketplace' },
        { label: 'Logistics', to: '/logistics' },
        { label: 'AI Forecast', to: '/ai-forecast' },
      ];
    }

    return [
      ...baseLinks,
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Marketplace', to: '/marketplace' },
      { label: 'Logistics', to: '/logistics' },
      { label: 'AI Forecast', to: '/ai-forecast' },
      { label: 'Track Shipment', to: '/tracking' },
    ];
  };

  const links = getNavigationLinks();

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #e5e7eb' }}>
      <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" color="primary" fontWeight={800}>
            RASS
          </Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          {links.map((link) => (
            <Button
              key={link.to}
              component={RouterLink}
              to={link.to}
              color={location.pathname === link.to ? 'primary' : 'inherit'}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {link.label}
            </Button>
          ))}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {user ? (
            <>
              {/* Cart Icon - show for Buyers */}
              {hasRole('Buyer') && <CartIcon />}

              {/* Notification Bell - show for all authenticated users */}
              <NotificationBell />

              <Typography variant="body2" fontWeight={600}>
                {user.fullName}
              </Typography>
              <Button variant="outlined" color="primary" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button component={RouterLink} to="/login" variant="contained" color="primary">
              Login
            </Button>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

