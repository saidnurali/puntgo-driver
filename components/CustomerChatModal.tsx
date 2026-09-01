import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { X, Send } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useOrder } from '../contexts/OrderContext';
import { logger } from '../utils/logger';

const GREEN = '#1F933F';
const GREY = '#6B7280';
const BORDER = '#E5E7EB';
const DARK = '#111827';
const LIGHT_BG = '#F9FAFB';

interface Message {
  id: string;
  order_id: string;
  sender_role: 'driver' | 'customer';
  sender_name: string;
  text: string;
  created_at: string;
}

interface CustomerChatModalProps {
  // Accept both string and number IDs — normalised internally
  orderId: string | number;
  visible: boolean;
  onClose: () => void;
}

export default function CustomerChatModal({ orderId, visible, onClose }: CustomerChatModalProps) {
  // ✅ Normalise orderId to string once — prevents .slice() crash on number IDs
  const orderIdStr = String(orderId ?? '');

  const { driverProfile } = useOrder();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // 1. Load full chat history from Supabase whenever the order changes
  const loadDriverChatHistory = async () => {
    if (!orderIdStr) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderIdStr)
        .order('created_at', { ascending: true });

      if (error) {
        logger.warn('[CustomerChatModal] Failed to load chat history:', error.message);
      } else if (data) {
        setMessages(data as Message[]);
      }
    } catch (e) {
      logger.error('[CustomerChatModal] loadDriverChatHistory unexpected error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderIdStr) {
      loadDriverChatHistory();
    }
  }, [orderIdStr]);

  // 2. Realtime subscription with permanent channel name & duplication guard
  useEffect(() => {
    if (!orderIdStr) return;

    const channel = supabase
      .channel(`chat_permanent_${orderIdStr}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${orderIdStr}`,
        },
        (payload) => {
          logger.debug('[CustomerChatModal] Realtime message received:', payload.new?.id);
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe((status) => {
        logger.debug('[CustomerChatModal] Chat channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderIdStr]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const msgText = text.trim();
    if (!msgText || sending) return;

    setText('');
    setSendError(null);
    setSending(true);

    const driverName = driverProfile?.full_name ?? 'Driver';

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const tempMsg: Message = {
      id: tempId,
      order_id: orderIdStr,
      sender_role: 'driver',
      sender_name: driverName,
      text: msgText,
      created_at: new Date().toISOString(),
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const { data, error } = await supabase
        .from('order_messages')
        .insert([{
          order_id: orderIdStr,
          sender_role: 'driver',
          sender_name: driverName,
          text: msgText,
        }])
        .select()
        .single();

      if (error) {
        logger.error('[CustomerChatModal] Failed to send message:', error.message);
        // Remove optimistic message and show error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setSendError('Failed to send message. Please try again.');
      } else if (data) {
        // Replace optimistic message with real one from DB
        setMessages((prev) => prev.map((m) => m.id === tempId ? data as Message : m));
      }
    } catch (e: any) {
      logger.error('[CustomerChatModal] handleSend unexpected error:', e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError('Network error. Message not sent.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isDriver = item.sender_role === 'driver';

    return (
      <View
        key={item.id || index}
        style={{
          alignSelf: isDriver ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          marginVertical: 4,
        }}
      >
        <View
          style={{
            backgroundColor: isDriver ? '#10B981' : '#E5E7EB',
            padding: 12,
            borderRadius: 16,
          }}
        >
          {!isDriver && (
            <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 2 }}>
              {item.sender_name ?? 'Customer'}
            </Text>
          )}
          <Text style={{ color: isDriver ? '#FFFFFF' : '#111827', fontSize: 15 }}>
            {item.text ?? ''}
          </Text>
          <Text
            style={{
              alignSelf: 'flex-end',
              color: isDriver ? '#D1FAE5' : '#9CA3AF',
              fontSize: 10,
              marginTop: 4,
            }}
          >
            {new Date(item.created_at ?? Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.safe}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Chat with Customer</Text>
              {/* ✅ Use orderIdStr — safe for both string and number IDs */}
              <Text style={styles.headerSub}>
                Order {orderIdStr.slice(-4).toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={DARK} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <View style={styles.chatArea}>
            {loading ? (
              <ActivityIndicator size="large" color={GREEN} style={{ marginTop: 40 }} />
            ) : messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No messages yet.</Text>
                <Text style={styles.emptySub}>Send a message to update the customer.</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderMessage}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          {/* Send Error Banner */}
          {!!sendError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{sendError}</Text>
              <TouchableOpacity onPress={() => setSendError(null)}>
                <X size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input Area */}
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={GREY}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={200}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              <Send size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  safe: {
    backgroundColor: LIGHT_BG,
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
  },
  headerSub: {
    fontSize: 13,
    color: GREY,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  chatArea: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: GREY,
  },
  emptySub: {
    fontSize: 14,
    color: GREY,
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  input: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 44,
    color: DARK,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
