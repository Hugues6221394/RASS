import React, { useState, useEffect, useRef } from 'react';
import { useSignalR } from '../context/SignalRContext';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'Success':
      return (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'Warning':
      return (
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      );
    case 'Error':
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      );
  }
};

export const NotificationBell: React.FC = () => {
  const { notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } = useSignalR();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<typeof notifications>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications from API
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/api/notifications?unreadOnly=false');
        setLocalNotifications(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.log('Could not fetch notifications');
      }
    };
    fetchNotifications();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Merge real-time notifications with fetched ones
  const allNotifications = [
    ...(Array.isArray(notifications) ? notifications : []),
    ...(Array.isArray(localNotifications) ? localNotifications.filter(
      ln => !(notifications || [])?.find(n => n.id === ln.id)
    ) : [])
  ].slice(0, 20);

  const handleOpenNotification = async (notification: any) => {
    try {
      await api.post(`/api/notifications/${notification.id}/read`);
      markNotificationRead(notification.id);
      setLocalNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
      if (notification.actionUrl) {
        setIsOpen(false);
        navigate(notification.actionUrl);
      } else {
        setIsOpen(false);
        navigate('/notifications');
      }
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`${unreadNotificationCount} notifications`}
        className="relative p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-[#EDF5F0] z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#EDF5F0] flex items-center justify-between">
            <h3 className="font-bold text-[#0D1B12]">{t('common.notifications', 'Notifications')}</h3>
            {unreadNotificationCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-[#00793E] hover:text-[#003D20] font-semibold flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
                </svg>
                {t('notifications.mark_all_read', 'Mark all read')}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {allNotifications.length === 0 ? (
              <div className="py-10 text-center">
                <svg className="w-12 h-12 mx-auto mb-2 text-[#9AAFA6]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <p className="text-[#4A6358]">{t('notifications.none', 'No notifications')}</p>
              </div>
            ) : (
              <div>
                {allNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleOpenNotification(notification)}
                    className={`w-full flex items-start gap-3 px-4 py-3 border-b border-[#EDF5F0] hover:bg-[#F4FAF7] transition-colors text-left
                      ${!notification.isRead ? 'bg-[#EDF5F0]/50' : ''}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm truncate ${notification.isRead ? 'text-[#4A6358]' : 'font-semibold text-[#0D1B12]'}`}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#00793E] text-white flex-shrink-0">
                            {t('common.new', 'NEW')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#4A6358] truncate">{notification.message}</p>
                      <p className="text-[10px] text-[#9AAFA6] mt-0.5">{new Date(notification.createdAt).toLocaleString()}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
