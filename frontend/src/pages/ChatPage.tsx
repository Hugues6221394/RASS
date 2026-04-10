import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSignalR } from '../context/SignalRContext';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Paperclip, Search, MoreVertical, 
  User, MessageSquare, Phone, Video,
  CornerUpLeft, Trash2, Check, CheckCheck,
  ChevronLeft, Ghost
} from 'lucide-react';

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
  replyToMessageId?: string;
  isDeleted?: boolean;
}

export const ChatPage: React.FC = () => {
  const { isConnected, onMessage } = useSignalR();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [availableUsers, setAvailableUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneLookup, setPhoneLookup] = useState('');
  const [phoneLookupMessage, setPhoneLookupMessage] = useState('');
  const [contactPickerLoading, setContactPickerLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await api.get('/api/chat/available-users');
        const users = response.data || [];
        setAvailableUsers(users);
        const convRes = await api.get('/api/chat/conversations').catch(() => ({ data: [] }));
        const unreadMap: Record<string, number> = {};
        (convRes.data || []).forEach((c: any) => {
          const uid = c.otherUserId || c.OtherUserId;
          const unread = c.unreadCount || c.UnreadCount || 0;
          if (uid) unreadMap[uid] = unread;
        });
        setUnreadByUser(unreadMap);
        const targetUserId = searchParams.get('userId');
        if (targetUserId && !selectedUser) {
          const target = users.find((u: ChatUser) => u.id === targetUserId);
          if (target) setSelectedUser(target);
        }
      } catch (error) {
        console.log('Could not fetch available users');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      const fetchConversation = async () => {
        try {
          setLoadingMessages(true);
          const response = await api.get(`/api/chat/conversation/${selectedUser.id}`);
          setMessages(response.data || []);
          setUnreadByUser(prev => ({ ...prev, [selectedUser.id]: 0 }));
        } catch (error) {
          console.log('Could not fetch conversation');
        } finally {
          setLoadingMessages(false);
        }
      };
      fetchConversation();
    }
  }, [selectedUser]);

  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      const senderId = (message as any).senderId || (message as any).SenderId;
      const content = (message as any).content || (message as any).Content;
      const sentAt = (message as any).sentAt || (message as any).SentAt;
      const replyToMessageId = (message as any).replyToMessageId || (message as any).ReplyToMessageId;
      const isDeleted = (message as any).isDeleted || (message as any).IsDeleted;
      if (selectedUser && senderId === selectedUser.id) {
        setMessages(prev => [...prev, {
          id: (message as any).id || (message as any).Id,
          senderId,
          content,
          sentAt,
          replyToMessageId,
          isDeleted,
          isMine: false
        }]);
      } else if (senderId) {
        setUnreadByUser(prev => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }));
      }
    });
    return unsubscribe;
  }, [onMessage, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedUser) return;
    try {
      const response = await api.post('/api/chat/send', {
        receiverId: selectedUser.id,
        content: newMessage,
        replyToMessageId: replyTo?.id || null,
      });
      setMessages(prev => [...prev, {
        id: response.data.id,
        senderId: user?.id || '',
        content: newMessage,
        sentAt: response.data.sentAt,
        replyToMessageId: replyTo?.id,
        isDeleted: false,
        isMine: true,
      }]);
      setNewMessage('');
      setReplyTo(null);
    } catch (error) {
      console.error('Failed to send message');
    }
  }, [newMessage, selectedUser, user, replyTo]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await api.delete(`/api/chat/messages/${messageId}`);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: 'This message was deleted', isDeleted: true } : m));
      if (replyTo?.id === messageId) setReplyTo(null);
    } catch {
      alert('Failed to delete message');
    }
  }, [replyTo]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    messages.forEach(m => map.set(m.id, m));
    return map;
  }, [messages]);

  const filteredUsers = availableUsers.filter(u => 
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLookupByPhone = async () => {
    const phone = phoneLookup.trim();
    if (!phone) return;
    setPhoneLookupMessage('');
    try {
      const res = await api.get('/api/chat/lookup-by-phone', { params: { phone } });
      const found: ChatUser = {
        id: String(res.data?.userId || ''),
        fullName: String(res.data?.fullName || ''),
        email: '',
        role: String(res.data?.role || 'User'),
      };
      if (!found.id) {
        setPhoneLookupMessage(t('chat.contact_not_on_platform', 'Selected contact does not use the platform.'));
        return;
      }
      setAvailableUsers((prev) => prev.some((u) => u.id === found.id) ? prev : [found, ...prev]);
      setSelectedUser(found);
      setPhoneLookup('');
      setPhoneLookupMessage(t('chat.chat_ready_with', 'Chat ready with {{name}}.', { name: found.fullName }));
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) setPhoneLookupMessage(t('chat.contact_not_on_platform', 'Selected contact does not use the platform.'));
      else if (status === 403) setPhoneLookupMessage(t('chat.contact_not_permitted', 'You cannot start a chat with this contact.'));
      else setPhoneLookupMessage(String(error?.response?.data || t('chat.lookup_failed', 'Unable to start chat from this contact.')));
    }
  };

  const handleStartNewChatFromContacts = async () => {
    const contactsApi = (navigator as any)?.contacts;
    if (!contactsApi?.select) {
      setPhoneLookupMessage(t('chat.contacts_not_supported', 'Device contacts are not supported in this browser.'));
      return;
    }
    try {
      setContactPickerLoading(true);
      const selected = await contactsApi.select(['name', 'tel'], { multiple: false });
      const first = Array.isArray(selected) && selected.length > 0 ? selected[0] : null;
      const phone = first?.tel?.[0];
      if (!phone) {
        setPhoneLookupMessage(t('chat.contact_phone_missing', 'Selected contact has no phone number.'));
        return;
      }
      setPhoneLookup(phone);
      await api.get('/api/chat/lookup-by-phone', { params: { phone } })
        .then((res) => {
          const found: ChatUser = {
            id: String(res.data?.userId || ''),
            fullName: String(res.data?.fullName || ''),
            email: '',
            role: String(res.data?.role || 'User'),
          };
          if (!found.id) {
            setPhoneLookupMessage(t('chat.contact_not_on_platform', 'Selected contact does not use the platform.'));
            return;
          }
          setAvailableUsers((prev) => prev.some((u) => u.id === found.id) ? prev : [found, ...prev]);
          setSelectedUser(found);
          setPhoneLookupMessage(t('chat.chat_ready_with', 'Chat ready with {{name}}.', { name: found.fullName }));
        })
        .catch((error: any) => {
          const status = error?.response?.status;
          if (status === 404) setPhoneLookupMessage(t('chat.contact_not_on_platform', 'Selected contact does not use the platform.'));
          else if (status === 403) setPhoneLookupMessage(t('chat.contact_not_permitted', 'You cannot start a chat with this contact.'));
          else setPhoneLookupMessage(String(error?.response?.data || t('chat.lookup_failed', 'Unable to start chat from this contact.')));
        });
    } catch {
      setPhoneLookupMessage(t('chat.contact_pick_cancelled', 'Contact selection was cancelled.'));
    } finally {
      setContactPickerLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#F8FAFC] overflow-hidden">
      
      {/* ── Contacts Sidebar ── */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col z-20 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-gray-50 bg-[#064E3B] text-white">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-black tracking-tight">{t('chat.messages', 'Messages')}</h1>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold ring-2 ring-white/20">
              {availableUsers.length}
            </div>
          </div>
          <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                  type="text" 
                  placeholder={t('chat.search_conversations', 'Search conversations...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white/10 border-0 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-white/40 focus:ring-2 focus:ring-[#34D399] transition-all"
                />
              </div>
              <button
                onClick={handleStartNewChatFromContacts}
                disabled={contactPickerLoading}
                className="mt-3 w-full rounded-2xl bg-white/15 px-3 py-2 text-xs font-black text-white hover:bg-white/25 disabled:opacity-50"
              >
                {contactPickerLoading ? t('chat.selecting_contact', 'Selecting contact...') : t('chat.start_new_chat', 'Start new chat')}
              </button>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={phoneLookup}
                onChange={(e) => setPhoneLookup(e.target.value)}
                placeholder={t('chat.start_with_phone', 'Start chat with phone number')}
                className="flex-1 rounded-2xl border-0 bg-white/10 px-3 py-2 text-xs font-bold text-white placeholder-white/40 focus:ring-2 focus:ring-[#34D399]"
              />
              <button onClick={handleLookupByPhone} className="rounded-2xl bg-white/15 px-3 py-2 text-xs font-black text-white hover:bg-white/25">{t('chat.find_contact', 'Find')}</button>
            </div>
          {phoneLookupMessage && <p className="mt-2 text-[11px] font-bold text-emerald-100">{phoneLookupMessage}</p>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {loadingUsers ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Ghost className="w-12 h-12 mb-4" />
              <p className="font-bold text-sm">{t('chat.no_contacts', 'No contacts found')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-[1.5rem] transition-all group relative
                    ${selectedUser?.id === u.id 
                      ? 'bg-emerald-50 shadow-sm border border-emerald-100' 
                      : 'hover:bg-gray-50 border border-transparent'}`}
                >
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm
                      ${selectedUser?.id === u.id ? 'bg-[#00793E] text-white' : 'bg-emerald-50 text-[#00793E]'}`}>
                      {u.fullName[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-black text-gray-800 text-sm truncate">{u.fullName}</p>
                        <span className="text-[9px] font-black text-gray-400">{t('chat.now', 'Now')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${unreadByUser[u.id] ? 'font-black text-[#00793E]' : 'text-gray-400 font-medium'}`}>
                        {unreadByUser[u.id] ? t('chat.new_message_received', 'New message received') : u.role}
                      </p>
                      {unreadByUser[u.id] > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#00793E] text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-emerald-900/20">
                          {unreadByUser[u.id] > 99 ? '99+' : unreadByUser[u.id]}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className={`flex-1 flex flex-col relative z-10 bg-white ${selectedUser ? 'flex' : 'hidden md:flex'}`}>
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedUser(null)} 
                  className="md:hidden w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:scale-95 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#00793E] relative">
                  <User className="w-6 h-6" />
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h2 className="font-black text-gray-800 leading-none mb-1">{selectedUser.fullName}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-[#00793E] uppercase tracking-wider">{selectedUser.role}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                     <span className="text-[10px] font-bold text-emerald-500">{t('chat.online', 'Online')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-[#00793E] transition-all"><Phone className="w-4 h-4" /></button>
                <button className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-[#00793E] transition-all"><Video className="w-4 h-4" /></button>
                <button className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-[#00793E] transition-all"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Messages Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#F8FAFC]">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-10 h-10 rounded-full border-4 border-emerald-100 border-t-[#00793E] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 text-center">
                  <MessageSquare className="w-16 h-16 mb-6" />
                   <h3 className="text-xl font-black">{t('chat.no_conversation_history', 'No conversation history')}</h3>
                   <p className="text-sm font-bold mt-2">{t('chat.start_discussion_hint', 'Start the discussion about crops or logistics')}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((msg, idx) => {
                    const replied = msg.replyToMessageId ? messageMap.get(msg.replyToMessageId) : null;
                    const isFirstInGroup = idx === 0 || messages[idx-1].senderId !== msg.senderId;
                    
                    return (
                      <motion.div 
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] relative group ${msg.isMine ? 'items-end' : 'items-start'}`}>
                          {replied && (
                            <div className={`mb-1 p-3 rounded-2xl text-xs border-l-4 shadow-sm backdrop-blur-md opacity-60 hover:opacity-100 transition-opacity
                              ${msg.isMine ? 'bg-emerald-900/5 border-emerald-600' : 'bg-white border-emerald-400'}`}>
                              <p className="font-black text-[9px] uppercase tracking-widest text-[#00793E] mb-1">{t('chat.reply_to_message', 'Reply to message')}</p>
                              <p className="line-clamp-1 italic">{replied.content}</p>
                            </div>
                          )}
                          <div className={`px-5 py-4 rounded-[1.75rem] shadow-sm relative transition-all group-hover:shadow-md
                            ${msg.isMine
                              ? 'bg-gradient-to-br from-[#064E3B] to-[#012d1b] text-white rounded-tr-[0.25rem]'
                              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-[0.25rem]'}`}>
                            <p className={`text-sm leading-relaxed ${msg.isDeleted ? 'italic opacity-60' : 'font-medium'}`}>{msg.content}</p>
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <span className={`text-[9px] font-bold ${msg.isMine ? 'text-white/40' : 'text-gray-400'}`}>
                                {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {msg.isMine && (
                                <CheckCheck className={`w-3 h-3 ${isConnected ? 'text-emerald-400' : 'text-white/20'}`} />
                              )}
                            </div>

                            {/* Hover Actions */}
                            <div className={`absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10
                              ${msg.isMine ? '-left-12 -translate-x-2' : '-right-12 translate-x-2'}`}>
                              {!msg.isDeleted && (
                                <button onClick={() => setReplyTo(msg)} className="w-8 h-8 rounded-full bg-white shadow-xl border border-gray-100 flex items-center justify-center text-gray-400 hover:text-emerald-600 active:scale-90"><CornerUpLeft className="w-4 h-4" /></button>
                              )}
                              {msg.isMine && !msg.isDeleted && (
                                <button onClick={() => handleDeleteMessage(msg.id)} className="w-8 h-8 rounded-full bg-white shadow-xl border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 active:scale-90"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Dashboard */}
            <div className="p-6 border-t border-gray-50 bg-white sticky bottom-0">
              <AnimatePresence>
                {replyTo && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <CornerUpLeft className="w-4 h-4 text-[#00793E]" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-[#00793E] uppercase tracking-widest">{t('chat.replying_to_message', 'Replying to message')}</p>
                        <p className="text-xs text-[#064E3B] truncate font-medium">{replyTo.content}</p>
                      </div>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#00793E] shadow-sm">✕</button>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex items-end gap-3">
                <button className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-[#00793E] transition-all flex-shrink-0">
                  <Paperclip className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('chat.write_message', 'Write a message...')}
                    className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-3.5 text-sm font-bold text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-[#00793E] focus:bg-white transition-all resize-none custom-scrollbar"
                    style={{ maxHeight: '120px' }}
                  />
                </div>
                <button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !isConnected}
                  className="w-12 h-12 rounded-2xl bg-[#00793E] text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
            <div className="w-32 h-32 rounded-[2.5rem] bg-emerald-50 flex items-center justify-center relative mb-8">
              <div className="absolute inset-0 bg-emerald-400/20 blur-3xl rounded-full"></div>
              <MessageSquare className="w-12 h-12 text-[#00793E] relative" />
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white shadow-xl border border-emerald-100 flex items-center justify-center animate-bounce">
                <span className="text-xs">👋</span>
              </div>
            </div>
            <h2 className="text-3xl font-black text-gray-800 mb-4">{t('chat.select_to_start', 'Select a conversation')}</h2>
              <p className="text-gray-400 font-bold max-w-sm">{t('chat.empty_state_subtitle', 'Connect with regional agricultural stakeholders and coordinate your operations in real-time.')}</p>
            <div className="grid grid-cols-2 gap-4 mt-12">
              <div className="p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-emerald-100 transition-all">
                 <p className="text-sm font-black text-gray-800 mb-1">{t('chat.direct_help', 'Direct Help')}</p>
                 <p className="text-xs text-gray-400 font-medium">{t('chat.direct_help_subtitle', 'Contact system admins for support')}</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-emerald-100 transition-all">
                 <p className="text-sm font-black text-gray-800 mb-1">{t('chat.market_logic', 'Market Logic')}</p>
                 <p className="text-xs text-gray-400 font-medium">{t('chat.market_logic_subtitle', 'Coordinate with buyers & sellers')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
