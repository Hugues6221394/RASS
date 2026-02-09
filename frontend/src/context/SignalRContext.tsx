import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'Info' | 'Success' | 'Warning' | 'Error';
    createdAt: string;
    isRead: boolean;
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
    unreadMessageCount: number;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    onMessage: (callback: (message: ChatMessage) => void) => () => void;
    onTyping: (callback: (senderId: string) => void) => () => void;
}

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
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    const messageCallbacksRef = useRef<Set<(message: ChatMessage) => void>>(new Set());
    const typingCallbacksRef = useRef<Set<(senderId: string) => void>>(new Set());

    // Connect to SignalR when authenticated
    useEffect(() => {
        if (!isAuthenticated || !token) {
            if (connection) {
                connection.stop();
                setConnection(null);
                setIsConnected(false);
            }
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${apiUrl}/hubs/notifications`, {
                accessTokenFactory: () => token,
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // Handle incoming notifications
        newConnection.on('ReceiveNotification', (notification: Notification) => {
            setNotifications(prev => [notification, ...prev]);
            setUnreadNotificationCount(prev => prev + 1);
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

        return () => {
            newConnection.stop();
        };
    }, [isAuthenticated, token]);

    const markNotificationRead = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    }, []);

    const markAllNotificationsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadNotificationCount(0);
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
