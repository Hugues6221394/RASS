import { Card, CardContent, Stack, Typography } from '@mui/material';

type Props = {
  label: string;
  value: string;
  helper?: string;
  accent?: 'primary' | 'secondary';
};

export const StatCard: React.FC<Props> = ({ label, value, helper, accent = 'primary' }) => {
  return (
    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="overline" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={800} color={accent}>
            {value}
          </Typography>
          {helper && (
            <Typography variant="body2" color="text.secondary">
              {helper}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

