const fs = require('fs');
const path = require('path');
const file = './src/pages/AIForecastingPage.tsx';
let txt = fs.readFileSync(file, 'utf8');

const oldStr = `  const cropKnowledgeBase: Record<string, string> = {
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
    for (const [cropName, info] of Object.entries(cropKnowledgeBase)) {
      if (lowerMessage.includes(cropName)) return \`\${info}\\n\\nWould you like to know more about \${cropName} farming practices, market prices, or pest management?\`;
    }
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('market'))
      return 'I can help you with market prices! Use the forecast tool above to get AI-powered price predictions for specific crops and markets.';
    if (lowerMessage.includes('plant') || lowerMessage.includes('grow') || lowerMessage.includes('farming'))
      return 'I can help with farming practices. Which crop are you interested in? I have information about maize, beans, potatoes, rice, tomatoes, bananas, cassava, and sweet potatoes.';
    if (lowerMessage.includes('season') || lowerMessage.includes('when to plant'))
      return 'Planting seasons vary by crop:\\n• Long rains: March-May\\n• Short rains: September-November\\n• Some crops like tomatoes can be grown year-round.\\n\\nWhich crop are you planning?';
    if (lowerMessage.includes('yield') || lowerMessage.includes('production'))
      return 'Crop yields depend on soil quality, weather, farming practices, and variety. Which crop are you interested in?';
    if (lowerMessage.includes('pest') || lowerMessage.includes('disease'))
      return 'Pest and disease management is crucial. Key practices:\\n• Crop rotation\\n• Resistant varieties\\n• Proper spacing\\n• Regular monitoring\\n\\nWhich crop are you having issues with?';
    if (lowerMessage.includes('soil') || lowerMessage.includes('fertilizer'))
      return 'Soil health is essential. Key practices:\\n• Soil testing\\n• Organic matter (compost, manure)\\n• Appropriate fertilizer\\n• Crop rotation\\n\\nWhat specific question do you have?';
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('help'))
      return 'Hello! I can help you with:\\n• Crop information\\n• Market prices and forecasts\\n• Planting seasons\\n• Yield expectations\\n• Pest management\\n• Soil advice\\n\\nWhat would you like to know?';
    return \`I understand you\\'re asking about: "\${userMessage}". Could you be more specific about which crop or topic you\\'re interested in?\`;
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'bot', content: getBotResponse(chatInput), timestamp: new Date() }]);
    }, 500);
  };`;

const newStr = `  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const messageContent = chatInput.trim();
    const userMessage: ChatMessage = { role: 'user', content: messageContent, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await api.post('/api/aichat/query', { message: messageContent });
      setChatMessages(prev => [...prev, { 
        role: 'bot', 
        content: response.data.response || t('forecast.chat_error_empty', 'I am sorry, I could not process your request.'), 
        timestamp: new Date() 
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        role: 'bot', 
        content: t('forecast.chat_error', 'Sorry, I am having trouble connecting to the server. Please try again later.'), 
        timestamp: new Date() 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };`;

if(txt.includes(oldStr)) {
  txt = txt.replace(oldStr, newStr);
  fs.writeFileSync(file, txt, 'utf8');
  console.log("Success");
} else {
  console.log("Not found block 2");
}
