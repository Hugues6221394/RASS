import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Fab,
    Paper,
    Box,
    Typography,
    TextField,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Badge,
    Collapse,
    Divider,
    CircularProgress,
    Chip,
} from '@mui/material';
import {
    Chat as ChatIcon,
    Close,
    Send,
    Person,
    Circle,
} from '@mui/icons-material';
import { useSignalR } from '../context/SignalRContext';
import { api } from '../api/client';

interface ChatUser {
    id: string;
    fullName: string;
    email: string;
    role: string;
}

interface Message {
    id: string;
    senderId: string;
    content: string;
    sentAt: string;
    isMine: boolean;
}

export const ChatWidget: React.FC = () => {
    const { isConnected, onMessage, unreadMessageCount } = useSignalR();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
    const [availableUsers, setAvailableUsers] = useState<ChatUser[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch available users
    useEffect(() => {
        if (isOpen && !selectedUser) {
            const fetchUsers = async () => {
                try {
                    setLoading(true);
                    const response = await api.get('/api/chat/available-users');
                    setAvailableUsers(response.data);
                } catch (error) {
                    console.log('Could not fetch available users');
                } finally {
                    setLoading(false);
                }
            };
            fetchUsers();
        }
    }, [isOpen, selectedUser]);

    // Fetch conversation when user is selected
    useEffect(() => {
        if (selectedUser) {
            const fetchConversation = async () => {
                try {
                    setLoading(true);
                    const response = await api.get(`/api/chat/conversation/${selectedUser.id}`);
                    setMessages(response.data);
                } catch (error) {
                    console.log('Could not fetch conversation');
                } finally {
                    setLoading(false);
                }
            };
            fetchConversation();
        }
    }, [selectedUser]);

    // Listen for incoming messages
    useEffect(() => {
        const unsubscribe = onMessage((message) => {
            if (selectedUser && message.senderId === selectedUser.id) {
                setMessages(prev => [...prev, { ...message, isMine: false }]);
            }
        });
        return unsubscribe;
    }, [onMessage, selectedUser]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = useCallback(async () => {
        if (!newMessage.trim() || !selectedUser) return;

        try {
            const response = await api.post('/api/chat/send', {
                receiverId: selectedUser.id,
                content: newMessage,
            });

            setMessages(prev => [...prev, {
                id: response.data.id,
                senderId: '',
                content: newMessage,
                sentAt: response.data.sentAt,
                isMine: true,
            }]);

            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message');
        }
    }, [newMessage, selectedUser]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <Fab
                color="primary"
                onClick={() => setIsOpen(!isOpen)}
                sx={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 1300,
                }}
            >
                <Badge badgeContent={unreadMessageCount} color="error">
                    {isOpen ? <Close /> : <ChatIcon />}
                </Badge>
            </Fab>

            {/* Chat Window */}
            <Collapse in={isOpen}>
                <Paper
                    elevation={8}
                    sx={{
                        position: 'fixed',
                        bottom: 90,
                        right: 24,
                        width: 360,
                        height: 480,
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 1300,
                        borderRadius: 2,
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {selectedUser ? (
                                    <>
                                        <IconButton size="small" onClick={() => setSelectedUser(null)} sx={{ color: 'white' }}>
                                            ←
                                        </IconButton>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            {selectedUser.fullName}
                                        </Typography>
                                    </>
                                ) : (
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Messages
                                    </Typography>
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Circle sx={{ fontSize: 10, color: isConnected ? 'success.light' : 'grey.400' }} />
                                <Typography variant="caption">
                                    {isConnected ? 'Online' : 'Offline'}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                <CircularProgress />
                            </Box>
                        ) : selectedUser ? (
                            /* Messages View */
                            <>
                                {messages.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <Typography color="text.secondary">No messages yet. Start the conversation!</Typography>
                                    </Box>
                                ) : (
                                    <List sx={{ p: 0 }}>
                                        {messages.map((msg) => (
                                            <ListItem
                                                key={msg.id}
                                                sx={{
                                                    flexDirection: msg.isMine ? 'row-reverse' : 'row',
                                                    py: 0.5,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        maxWidth: '75%',
                                                        bgcolor: msg.isMine ? 'primary.main' : 'grey.100',
                                                        color: msg.isMine ? 'white' : 'text.primary',
                                                        borderRadius: 2,
                                                        px: 2,
                                                        py: 1,
                                                    }}
                                                >
                                                    <Typography variant="body2">{msg.content}</Typography>
                                                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                                        {new Date(msg.sentAt).toLocaleTimeString()}
                                                    </Typography>
                                                </Box>
                                            </ListItem>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </List>
                                )}
                            </>
                        ) : (
                            /* User List View */
                            <List sx={{ p: 0 }}>
                                {availableUsers.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <Typography color="text.secondary">No contacts available</Typography>
                                    </Box>
                                ) : (
                                    availableUsers.map((user) => (
                                        <ListItem
                                            key={user.id}
                                            button
                                            onClick={() => setSelectedUser(user)}
                                            sx={{ borderRadius: 1, mb: 0.5 }}
                                        >
                                            <ListItemAvatar>
                                                <Avatar>
                                                    <Person />
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={user.fullName}
                                                secondary={
                                                    <Chip size="small" label={user.role} sx={{ height: 20, fontSize: '0.7rem' }} />
                                                }
                                            />
                                        </ListItem>
                                    ))
                                )}
                            </List>
                        )}
                    </Box>

                    {/* Message Input */}
                    {selectedUser && (
                        <>
                            <Divider />
                            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Type a message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={!isConnected}
                                />
                                <IconButton
                                    color="primary"
                                    onClick={handleSendMessage}
                                    disabled={!newMessage.trim() || !isConnected}
                                >
                                    <Send />
                                </IconButton>
                            </Box>
                        </>
                    )}
                </Paper>
            </Collapse>
        </>
    );
};
