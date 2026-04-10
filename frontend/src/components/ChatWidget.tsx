import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSignalR } from '../context/SignalRContext';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        style={{ background: 'linear-gradient(135deg,#003D20,#00793E)' }}
      >
        {unreadMessageCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
            {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
          </span>
        )}
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] h-[460px] bg-white rounded-2xl shadow-2xl border border-[#EDF5F0] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#002D15,#003D20,#00793E)' }}>
            <div className="flex items-center gap-2">
              {selectedUser && (
                <button onClick={() => setSelectedUser(null)} className="text-white/80 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
              )}
              <p className="font-semibold text-white text-sm">
                {selectedUser ? selectedUser.fullName : t('chat.messages', 'Messages')}
              </p>
            </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
            <span className="text-[10px] text-white/80">{isConnected ? t('chat.online', 'Online') : t('chat.offline', 'Offline')}</span>
          </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 bg-[#F4FAF7]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 rounded-full border-2 border-[#D9EFE4] border-t-[#00793E] animate-spin" />
              </div>
            ) : selectedUser ? (
              /* Messages View */
              messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <p className="text-sm text-[#4A6358]">{t('chat.no_messages', 'No messages yet')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm
                        ${msg.isMine
                          ? 'bg-[#003D20] text-white rounded-br-md'
                          : 'bg-white text-[#0D1B12] rounded-bl-md shadow-sm'}`}>
                        <p>{msg.content}</p>
                        <p className={`text-[9px] mt-0.5 ${msg.isMine ? 'text-green-200' : 'text-[#9AAFA6]'}`}>
                          {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )
            ) : (
              /* User List View */
              availableUsers.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <p className="text-sm text-[#4A6358]">{t('chat.no_contacts', 'No contacts available')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {availableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#D9EFE4] flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#003D20]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#0D1B12] truncate">{user.fullName}</p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EDF5F0] text-[#003D20]">{user.role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Message Input */}
          {selectedUser && (
            <div className="px-3 py-2 border-t border-[#EDF5F0] flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                className="form-input flex-1 text-sm py-2"
                placeholder={t('chat.placeholder', 'Type a message...')}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!isConnected}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || !isConnected}
                className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#003D20,#00793E)' }}
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
