import React, { useState, useEffect } from 'react';
import {
    Badge,
    IconButton,
    Popover,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Typography,
    Box,
    Button,
    Divider,
    Chip,
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    Info,
    CheckCircle,
    Warning,
    Error as ErrorIcon,
    MarkEmailRead,
} from '@mui/icons-material';
import { useSignalR } from '../context/SignalRContext';
import { api } from '../api/client';

const getNotificationIcon = (type: string) => {
    switch (type) {
        case 'Success':
            return <CheckCircle color="success" />;
        case 'Warning':
            return <Warning color="warning" />;
        case 'Error':
            return <ErrorIcon color="error" />;
        default:
            return <Info color="info" />;
    }
};

export const NotificationBell: React.FC = () => {
    const { notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } = useSignalR();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [localNotifications, setLocalNotifications] = useState<typeof notifications>([]);

    // Fetch initial notifications from API
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await api.get('/api/notifications?unreadOnly=false');
                setLocalNotifications(response.data);
            } catch (error) {
                console.log('Could not fetch notifications');
            }
        };
        fetchNotifications();
    }, []);

    // Merge real-time notifications with fetched ones
    const allNotifications = [...notifications, ...localNotifications.filter(
        ln => !notifications.find(n => n.id === ln.id)
    )].slice(0, 20);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleMarkRead = async (id: string) => {
        try {
            await api.post(`/api/notifications/${id}/read`);
            markNotificationRead(id);
            setLocalNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );
        } catch (error) {
            console.error('Failed to mark notification as read');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.post('/api/notifications/read-all');
            markAllNotificationsRead();
            setLocalNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all notifications as read');
        }
    };

    const open = Boolean(anchorEl);

    return (
        <>
            <IconButton
                color="inherit"
                onClick={handleClick}
                aria-label={`${unreadNotificationCount} notifications`}
            >
                <Badge badgeContent={unreadNotificationCount} color="error">
                    <NotificationsIcon />
                </Badge>
            </IconButton>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                PaperProps={{
                    sx: { width: 360, maxHeight: 480 }
                }}
            >
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight={600}>
                        Notifications
                    </Typography>
                    {unreadNotificationCount > 0 && (
                        <Button
                            size="small"
                            startIcon={<MarkEmailRead />}
                            onClick={handleMarkAllRead}
                        >
                            Mark all read
                        </Button>
                    )}
                </Box>
                <Divider />

                {allNotifications.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography color="text.secondary">No notifications yet</Typography>
                    </Box>
                ) : (
                    <List sx={{ p: 0 }}>
                        {allNotifications.map((notification) => (
                            <ListItem
                                key={notification.id}
                                sx={{
                                    bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'action.selected' }
                                }}
                                onClick={() => handleMarkRead(notification.id)}
                            >
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    {getNotificationIcon(notification.type)}
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="subtitle2" fontWeight={notification.isRead ? 400 : 600}>
                                                {notification.title}
                                            </Typography>
                                            {!notification.isRead && (
                                                <Chip size="small" label="New" color="primary" sx={{ height: 18 }} />
                                            )}
                                        </Box>
                                    }
                                    secondary={
                                        <>
                                            <Typography variant="body2" color="text.secondary" noWrap>
                                                {notification.message}
                                            </Typography>
                                            <Typography variant="caption" color="text.disabled">
                                                {new Date(notification.createdAt).toLocaleString()}
                                            </Typography>
                                        </>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Popover>
        </>
    );
};
