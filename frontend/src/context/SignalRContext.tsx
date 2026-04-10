import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { api } from '../api/client';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'Info' | 'Success' | 'Warning' | 'Error';
    createdAt: string;
    isRead: boolean;
    actionUrl?: string;
}

interface ChatMessage {
    id: string;
    senderId: string;
    senderName?: string;
    content: string;
    sentAt: string;
}

interface SignalRContextType {
    connection: signalR.HubConnection | null;
    isConnected: boolean;
    notifications: Notification[];
    unreadNotificationCount: number;
    unreadByRoute: Record<string, number>;
    unreadContractCount: number;
    unreadMessageCount: number;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    onMessage: (callback: (message: ChatMessage) => void) => () => void;
    onTyping: (callback: (senderId: string) => void) => () => void;
}

const isContractNotification = (notification: Notification) =>
    /contract/i.test(notification.title || '') || /contract/i.test(notification.message || '') || /\/contracts/i.test(notification.actionUrl || '');

const normalizeNotification = (notification: any): Notification => ({
    id: String(notification?.id ?? notification?.Id ?? crypto.randomUUID()),
    title: String(notification?.title ?? notification?.Title ?? 'Notification'),
    message: String(notification?.message ?? notification?.Message ?? ''),
    type: (notification?.type ?? notification?.Type ?? 'Info') as Notification['type'],
    createdAt: String(notification?.createdAt ?? notification?.CreatedAt ?? new Date().toISOString()),
    isRead: Boolean(notification?.isRead ?? notification?.IsRead ?? false),
    actionUrl: (notification?.actionUrl ?? notification?.ActionUrl ?? undefined) as string | undefined,
});

const routeKeyFromActionUrl = (actionUrl?: string) => {
    if (!actionUrl) return '';
    try {
        const parsed = actionUrl.startsWith('http') ? new URL(actionUrl) : new URL(actionUrl, window.location.origin);
        return parsed.pathname.toLowerCase();
    } catch {
        return actionUrl.split('?')[0]?.toLowerCase() || '';
    }
};

const routeKeyFromNotification = (notification: Notification) => {
    const fromUrl = routeKeyFromActionUrl(notification.actionUrl);
    if (fromUrl) return fromUrl;
    const haystack = `${notification.title} ${notification.message}`.toLowerCase();
    if (haystack.includes('contract')) return '/contracts';
    if (haystack.includes('message') || haystack.includes('chat')) return '/messages';
    if (haystack.includes('application') || haystack.includes('applicant') || haystack.includes('approval') || haystack.includes('role request')) return '/admin';
    if (haystack.includes('price') || haystack.includes('regulation')) return '/prices';
    return '/notifications';
};

const buildUnreadByRoute = (rows: Notification[]) =>
    rows.reduce((acc: Record<string, number>, n: Notification) => {
        if (n.isRead) return acc;
        const key = routeKeyFromNotification(n);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const useSignalR = () => {
    const context = useContext(SignalRContext);
    if (!context) {
        throw new Error('useSignalR must be used within a SignalRProvider');
    }
    return context;
};

interface SignalRProviderProps {
    children: React.ReactNode;
}

export const SignalRProvider: React.FC<SignalRProviderProps> = ({ children }) => {
    const { isAuthenticated, token } = useAuth();
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [unreadByRoute, setUnreadByRoute] = useState<Record<string, number>>({});
    const [unreadContractCount, setUnreadContractCount] = useState(0);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    const messageCallbacksRef = useRef<Set<(message: ChatMessage) => void>>(new Set());
    const typingCallbacksRef = useRef<Set<(senderId: string) => void>>(new Set());

    const syncUnreadState = useCallback(async () => {
        try {
            const [notifRes, chatRes, unreadNotifications] = await Promise.all([
                api.get('/api/notifications/badge-count'),
                api.get('/api/chat/unread-count'),
                api.get('/api/notifications?unreadOnly=true'),
            ]);

            const rows = Array.isArray(unreadNotifications.data) ? unreadNotifications.data : [];
            const normalizedRows = rows.map(normalizeNotification);
            setUnreadNotificationCount(notifRes.data?.count ?? normalizedRows.length ?? 0);
            setUnreadMessageCount(chatRes.data?.count ?? 0);
            setNotifications(normalizedRows);
            setUnreadContractCount(normalizedRows.filter((n: Notification) => !n.isRead && isContractNotification(n)).length);
            setUnreadByRoute(buildUnreadByRoute(normalizedRows));
        } catch (error) {
            console.error('Failed to sync unread state', error);
        }
    }, []);

    // Connect to SignalR when authenticated
    useEffect(() => {
        if (!isAuthenticated || !token) {
            if (connection) {
                connection.stop();
                setConnection(null);
                setIsConnected(false);
            }
            setNotifications([]);
            setUnreadNotificationCount(0);
            setUnreadByRoute({});
            setUnreadContractCount(0);
            setUnreadMessageCount(0);
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5172';
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${apiUrl}/hubs/notifications`, {
                accessTokenFactory: () => token,
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // Handle incoming notifications
        newConnection.on('ReceiveNotification', (raw: Notification) => {
            const notification = normalizeNotification(raw);
            setNotifications(prev => [notification, ...prev]);
            if (!notification.isRead) {
                setUnreadNotificationCount(prev => prev + 1);
                const routeKey = routeKeyFromNotification(notification);
                setUnreadByRoute(prev => ({ ...prev, [routeKey]: (prev[routeKey] || 0) + 1 }));
                if (isContractNotification(notification)) setUnreadContractCount(prev => prev + 1);
            }
        });

        // Handle incoming messages
        newConnection.on('ReceiveMessage', (message: ChatMessage) => {
            messageCallbacksRef.current.forEach(callback => callback(message));
            setUnreadMessageCount(prev => prev + 1);
        });

        // Handle typing indicator
        newConnection.on('UserTyping', (senderId: string) => {
            typingCallbacksRef.current.forEach(callback => callback(senderId));
        });

        // Start connection
        newConnection.start()
            .then(() => {
                setIsConnected(true);
                console.log('SignalR connected');
            })
            .catch((err: Error) => {
                console.error('SignalR connection error:', err);
            });

        newConnection.onreconnected(() => {
            setIsConnected(true);
        });

        newConnection.onreconnecting(() => {
            setIsConnected(false);
        });

        newConnection.onclose(() => {
            setIsConnected(false);
        });

        setConnection(newConnection);

        void syncUnreadState();

        return () => {
            newConnection.stop();
        };
    }, [isAuthenticated, token, syncUnreadState]);

    useEffect(() => {
        if (!isAuthenticated || !token) return;
        void syncUnreadState();
        const timer = window.setInterval(() => {
            void syncUnreadState();
        }, 15000);
        return () => window.clearInterval(timer);
    }, [isAuthenticated, token, syncUnreadState]);

    const markNotificationRead = useCallback((id: string) => {
        const target = notifications.find(n => n.id === id);
        if (!target || target.isRead) return;
        const wasContractUnread = isContractNotification(target);
        const routeKey = routeKeyFromNotification(target);
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
        setUnreadNotificationCount(prev => Math.max(0, prev - 1));
        setUnreadByRoute(prev => ({ ...prev, [routeKey]: Math.max(0, (prev[routeKey] || 0) - 1) }));
        if (wasContractUnread) setUnreadContractCount(prev => Math.max(0, prev - 1));
    }, [notifications]);

    const markAllNotificationsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadNotificationCount(0);
        setUnreadByRoute({});
        setUnreadContractCount(0);
    }, []);

    const onMessage = useCallback((callback: (message: ChatMessage) => void) => {
        messageCallbacksRef.current.add(callback);
        return () => {
            messageCallbacksRef.current.delete(callback);
        };
    }, []);

    const onTyping = useCallback((callback: (senderId: string) => void) => {
        typingCallbacksRef.current.add(callback);
        return () => {
            typingCallbacksRef.current.delete(callback);
        };
    }, []);

    return (
        <SignalRContext.Provider
            value={{
                connection,
                isConnected,
                notifications,
                unreadNotificationCount,
                unreadByRoute,
                unreadContractCount,
                unreadMessageCount,
                markNotificationRead,
                markAllNotificationsRead,
                onMessage,
                onTyping,
            }}
        >
            {children}
        </SignalRContext.Provider>
    );
};
