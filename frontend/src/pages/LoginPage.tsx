import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { LoginRequest } from '../types';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    defaultValues: { email: 'admin@rass.rw', password: 'Pass@123' },
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: LoginRequest) => {
    setError(null);
    try {
      await login(data);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Login failed. Check credentials.');
    }
  };

  return (
    <Box display="flex" justifyContent="center" mt={6} px={2}>
      <Card sx={{ maxWidth: 420, width: '100%', border: '1px solid #e5e7eb' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={800}>
              Sign in to RASS
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use the testing credentials or your assigned role accounts.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={2}>
                <TextField label="Email" fullWidth {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  {...register('password')}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
                <Button type="submit" variant="contained" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Login'}
                </Button>
              </Stack>
            </form>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

