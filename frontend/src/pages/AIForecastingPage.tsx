import { useState, useRef, useEffect } from 'react';
import { Box, Card, CardContent, CardHeader, Stack, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, Grid, Alert, CircularProgress, IconButton, Paper, Chip, LinearProgress } from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { TrendingUp, TrendingDown, TrendingFlat, Info, Send, SmartToy, ShowChart, Speed, Lightbulb } from '@mui/icons-material';
import axios from 'axios';

interface ForecastResult {
  forecast_date: string;
  forecast_period_days: number;
  predictions: Array<{
    date: string;
    median: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  trend: 'UP' | 'STABLE' | 'DOWN';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  recommendation: string;
  explanation: string;
  top_factors: string[];
}

// Forecasting service URL (Python ML service)
const FORECAST_SERVICE_URL = import.meta.env.VITE_FORECAST_API_URL || 'http://localhost:8001';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export const AIForecastingPage = () => {
  const [crop, setCrop] = useState('');
  const [market, setMarket] = useState('');
  const [days, setDays] = useState(7);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'bot',
      content: 'Hello! I\'m your AI crop assistant. I can help you with crop information, farming tips, market insights, and more. What would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: latestPrices } = useQuery({
    queryKey: ['market-latest'],
    queryFn: async () => {
      const res = await api.get('/api/marketprices/latest');
      return res.data;
    },
  });

  const { data: forecast, isLoading, error, refetch } = useQuery<ForecastResult>({
    queryKey: ['forecast', crop, market, days],
    queryFn: async () => {
      // Call the Python forecasting service's enhanced endpoint
      const res = await axios.post(`${FORECAST_SERVICE_URL}/forecast/price/enhanced`, {
        crop,
        market,
        days,
        // Optional: Add external factors for more accurate predictions
        external_factors: {
          season: getCurrentSeason(),
          fuelPriceIndex: 1.0,  // Placeholder - could be fetched from an API
          demandIndex: 1.0
        }
      });
      return res.data;
    },
    enabled: false, // Only fetch when user clicks button
  });

  // Helper function to determine current season in Rwanda
  const getCurrentSeason = (): string => {
    const month = new Date().getMonth() + 1;
    if (month >= 9 || month <= 1) return 'harvesting';  // Season A
    if (month >= 2 && month <= 6) return 'planting';     // Season B
    return 'lean';  // Dry season (Jul-Aug)
  };

  const handleForecast = () => {
    if (crop && market) {
      refetch();
    }
  };

  const availableCrops = latestPrices ? [...new Set(latestPrices.map((p: any) => p.crop))] : [];
  const availableMarkets = latestPrices ? [...new Set(latestPrices.map((p: any) => p.market))] : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const cropKnowledgeBase: Record<string, string> = {
    'maize': 'Maize is a staple crop in Rwanda. Best planting season is March-April and September-October. Requires well-drained soil and regular rainfall. Average yield: 2-4 tons per hectare.',
    'beans': 'Beans are a key protein source. Plant during the long rains (March-May) or short rains (September-November). Intercropping with maize is common. Average yield: 0.8-1.5 tons per hectare.',
    'potato': 'Potatoes thrive in cool, high-altitude areas. Plant in February-March or August-September. Requires fertile, well-drained soil. Average yield: 15-25 tons per hectare.',
    'rice': 'Rice grows well in lowland areas with good water management. Main season is September-December. Requires consistent water supply. Average yield: 4-6 tons per hectare.',
    'tomato': 'Tomatoes can be grown year-round with irrigation. Best in warm, sunny conditions. Requires staking and regular pest management. Average yield: 20-40 tons per hectare.',
    'banana': 'Bananas are perennial crops. Plant suckers in well-drained soil. Requires regular mulching and organic matter. Average yield: 20-30 tons per hectare.',
    'cassava': 'Cassava is drought-tolerant and grows in various soils. Plant cuttings during rainy season. Takes 8-12 months to mature. Average yield: 10-20 tons per hectare.',
    'sweet potato': 'Sweet potatoes are drought-resistant. Plant vines during rainy season. Requires loose, well-drained soil. Average yield: 8-15 tons per hectare.'
  };

  const getBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    // Crop-specific questions
    for (const [cropName, info] of Object.entries(cropKnowledgeBase)) {
      if (lowerMessage.includes(cropName)) {
        return `${info}\n\nWould you like to know more about ${cropName} farming practices, market prices, or pest management?`;
      }
    }

    // General questions
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('market')) {
      return 'I can help you with market prices! Use the forecast tool above to get AI-powered price predictions for specific crops and markets. You can also ask me about price trends or market insights.';
    }

    if (lowerMessage.includes('plant') || lowerMessage.includes('grow') || lowerMessage.includes('farming')) {
      return 'Great question! I can help with farming practices. Which crop are you interested in? I have information about maize, beans, potatoes, rice, tomatoes, bananas, cassava, and sweet potatoes.';
    }

    if (lowerMessage.includes('season') || lowerMessage.includes('when to plant')) {
      return 'Planting seasons vary by crop and region in Rwanda:\n• Long rains: March-May\n• Short rains: September-November\n• Some crops like tomatoes can be grown year-round with irrigation.\n\nWhich crop are you planning to grow?';
    }

    if (lowerMessage.includes('yield') || lowerMessage.includes('production')) {
      return 'Crop yields depend on many factors: soil quality, weather, farming practices, and crop variety. I can provide average yield ranges for different crops. Which crop are you interested in?';
    }

    if (lowerMessage.includes('pest') || lowerMessage.includes('disease')) {
      return 'Pest and disease management is crucial for good yields. Common practices include:\n• Crop rotation\n• Use of resistant varieties\n• Proper spacing\n• Regular monitoring\n• Organic or chemical treatments when needed\n\nWhich crop are you having issues with?';
    }

    if (lowerMessage.includes('soil') || lowerMessage.includes('fertilizer')) {
      return 'Soil health is essential for good yields. Key practices:\n• Soil testing to determine nutrient needs\n• Use of organic matter (compost, manure)\n• Appropriate fertilizer application\n• Crop rotation to maintain soil fertility\n\nWhat specific soil question do you have?';
    }

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('help')) {
      return 'Hello! I can help you with:\n• Crop information and farming practices\n• Market prices and forecasts\n• Planting seasons\n• Yield expectations\n• Pest and disease management\n• Soil and fertilizer advice\n\nWhat would you like to know?';
    }

    // Default response
    return 'I understand you\'re asking about: "' + userMessage + '". I can help with crop information, farming practices, market prices, planting seasons, and more. Could you be more specific about which crop or topic you\'re interested in?';
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');

    // Simulate bot thinking
    setTimeout(() => {
      const botResponse: ChatMessage = {
        role: 'bot',
        content: getBotResponse(chatInput),
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, botResponse]);
    }, 500);
  };

  return (
    <Box px={{ xs: 2, md: 6 }} py={4}>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight={800} color="primary">
          AI-Powered Forecasting
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Get intelligent price forecasts using advanced machine learning models. Make data-driven decisions for your agricultural business.
        </Typography>

        <Card elevation={2}>
          <CardHeader title="Forecast Parameters" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Crop</InputLabel>
                  <Select
                    value={crop}
                    label="Crop"
                    onChange={(e) => setCrop(e.target.value)}
                  >
                    {availableCrops.map((c: string) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Market</InputLabel>
                  <Select
                    value={market}
                    label="Market"
                    onChange={(e) => setMarket(e.target.value)}
                  >
                    {availableMarkets.map((m: string) => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="Days"
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value) || 7)}
                  inputProps={{ min: 1, max: 30 }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleForecast}
                  disabled={!crop || !market || isLoading}
                  sx={{ height: '56px' }}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Forecast'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error">
            Failed to generate forecast. Please try again.
          </Alert>
        )}

        {forecast && (
          <Stack spacing={3}>
            {/* Main Recommendation Card */}
            <Card
              elevation={3}
              sx={{
                bgcolor: forecast.recommendation === 'Sell Now' ? 'success.main' :
                  forecast.recommendation === 'Hold' ? 'warning.main' : 'info.main',
                color: 'white'
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  {forecast.trend === 'UP' ? (
                    <TrendingUp fontSize="large" />
                  ) : forecast.trend === 'DOWN' ? (
                    <TrendingDown fontSize="large" />
                  ) : (
                    <TrendingFlat fontSize="large" />
                  )}
                  <Box flex={1}>
                    <Typography variant="h4" fontWeight={800}>
                      {forecast.recommendation}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.95, mt: 1 }}>
                      {forecast.explanation}
                    </Typography>
                  </Box>
                </Stack>

                {/* Trend, Volatility, Confidence Chips */}
                <Stack direction="row" spacing={1} flexWrap="wrap" mt={2}>
                  <Chip
                    icon={<ShowChart />}
                    label={`Trend: ${forecast.trend}`}
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip
                    icon={<Speed />}
                    label={`Volatility: ${forecast.volatility}`}
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip
                    label={`Confidence: ${Math.round(forecast.confidence * 100)}%`}
                    sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 600 }}
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Top Factors Card */}
            {forecast.top_factors && forecast.top_factors.length > 0 && (
              <Card elevation={2}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                    <Lightbulb color="warning" />
                    <Typography variant="h6" fontWeight={600}>Key Factors Affecting Price</Typography>
                  </Stack>
                  <Stack spacing={1}>
                    {forecast.top_factors.map((factor, idx) => (
                      <Alert key={idx} severity="info" variant="outlined" sx={{ py: 0.5 }}>
                        {factor}
                      </Alert>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Price Predictions Card */}
            <Card elevation={2}>
              <CardHeader
                title="Price Forecast Details"
                subheader={`Next ${forecast.forecast_period_days} days with 80% confidence intervals`}
              />
              <CardContent>
                <Stack spacing={3}>
                  {/* Confidence Progress Bar */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Model Confidence
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={forecast.confidence * 100}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: forecast.confidence > 0.7 ? 'success.main' :
                            forecast.confidence > 0.5 ? 'warning.main' : 'error.main'
                        }
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(forecast.confidence * 100)}% confident in this prediction
                    </Typography>
                  </Box>

                  {/* Daily Predictions Grid */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Daily Price Predictions (RWF/kg)
                    </Typography>
                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }} gap={2}>
                      {forecast.predictions.map((pred, idx) => (
                        <Card key={idx} variant="outlined" sx={{ overflow: 'visible' }}>
                          <CardContent sx={{ p: 2 }}>
                            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                              {new Date(pred.date).toLocaleDateString('en-RW', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Typography>
                            <Typography variant="h5" fontWeight={700} color="primary.main">
                              {pred.median.toFixed(0)}
                            </Typography>
                            <Stack direction="row" spacing={1} mt={1}>
                              <Chip
                                size="small"
                                label={`↓${pred.lower_bound.toFixed(0)}`}
                                sx={{ fontSize: '0.7rem', height: 20, bgcolor: 'error.light', color: 'error.contrastText' }}
                              />
                              <Chip
                                size="small"
                                label={`↑${pred.upper_bound.toFixed(0)}`}
                                sx={{ fontSize: '0.7rem', height: 20, bgcolor: 'success.light', color: 'success.contrastText' }}
                              />
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* How to Use Card */}
            <Card elevation={1} sx={{ bgcolor: 'grey.50' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Info />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      How to Use This Forecast
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • The <strong>median price</strong> is the most likely price scenario.
                      <br />
                      • The <strong>lower/upper bounds</strong> show the 80% confidence range.
                      <br />
                      • <strong>Trend</strong> indicates price direction: UP, STABLE, or DOWN.
                      <br />
                      • <strong>Volatility</strong> shows market stability: LOW, MEDIUM, or HIGH.
                      <br />
                      • Use the <strong>recommendation</strong> (Sell Now, Hold, Monitor) to guide your decisions.
                      <br />
                      • Higher confidence means the model is more certain about the forecast.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}

        {!forecast && !isLoading && (
          <Card elevation={1}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Info color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Select a crop and market above, then click "Forecast" to get AI-powered price predictions.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* AI Chat Assistant */}
        <Card elevation={2} sx={{ mt: 4 }}>
          <CardHeader
            avatar={<SmartToy color="primary" />}
            title="AI Crop Assistant"
            subheader="Ask me anything about crops, farming, or market prices"
          />
          <CardContent>
            <Paper
              sx={{
                height: 400,
                overflow: 'auto',
                p: 2,
                mb: 2,
                bgcolor: 'grey.50',
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
            >
              {chatMessages.map((msg, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      maxWidth: '70%',
                      bgcolor: msg.role === 'user' ? 'primary.main' : 'white',
                      color: msg.role === 'user' ? 'white' : 'text.primary',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 1 }}>
                      {msg.timestamp.toLocaleTimeString()}
                    </Typography>
                  </Paper>
                </Box>
              ))}
              <div ref={chatEndRef} />
            </Paper>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask about crops, farming, prices..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                <Send />
              </IconButton>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box >
  );
};

