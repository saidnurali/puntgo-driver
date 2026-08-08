import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type DriverStatus = 'online' | 'offline';

export interface Ride {
  id: string;
  passenger_name: string;
  passenger_phone: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number;
  estimated_fare: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface DriverProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  status: DriverStatus;
  rating: number;
  total_rides: number;
  total_earnings: number;
  vehicle_model?: string;
  vehicle_plate?: string;
  profile_photo?: string;
}

interface RideContextType {
  driverStatus: DriverStatus;
  setDriverStatus: (status: DriverStatus) => Promise<void>;
  driverProfile: DriverProfile | null;
  currentRide: Ride | null;
  pendingRide: Ride | null;
  todayEarnings: number;
  todayRides: number;
  acceptRide: (rideId: string) => Promise<void>;
  declineRide: (rideId: string) => Promise<void>;
  completeRide: (rideId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const RideContext = createContext<RideContextType>({
  driverStatus: 'offline',
  setDriverStatus: async () => {},
  driverProfile: null,
  currentRide: null,
  pendingRide: null,
  todayEarnings: 0,
  todayRides: 0,
  acceptRide: async () => {},
  declineRide: async () => {},
  completeRide: async () => {},
  refreshProfile: async () => {},
});

export function RideProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [driverStatus, setDriverStatusState] = useState<DriverStatus>('offline');
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [pendingRide, setPendingRide] = useState<Ride | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayRides, setTodayRides] = useState(0);
  const subscriptionRef = useRef<any>(null);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) {
      setDriverProfile(data);
      setDriverStatusState(data.status ?? 'offline');
    }
  };

  const fetchTodayStats = async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('rides')
      .select('estimated_fare, status')
      .eq('driver_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', today.toISOString());

    if (data) {
      setTodayRides(data.length);
      setTodayEarnings(data.reduce((sum, r) => sum + (r.estimated_fare ?? 0), 0));
    }
  };

  const fetchCurrentRide = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('driver_id', user.id)
      .in('status', ['accepted', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data) setCurrentRide(data);
  };

  useEffect(() => {
    if (!user) return;
    fetchProfile();
    fetchTodayStats();
    fetchCurrentRide();

    // Subscribe to incoming ride requests
    subscriptionRef.current = supabase
      .channel('ride-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: 'status=eq.pending' },
        (payload) => {
          setPendingRide(payload.new as Ride);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides' },
        (payload) => {
          const updated = payload.new as Ride;
          if (updated.driver_id === user.id) {
            if (updated.status === 'accepted' || updated.status === 'in_progress') {
              setCurrentRide(updated);
              setPendingRide(null);
            } else if (updated.status === 'completed' || updated.status === 'cancelled') {
              setCurrentRide(null);
              fetchTodayStats();
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user]);

  const setDriverStatus = async (status: DriverStatus) => {
    if (!user) return;
    setDriverStatusState(status);
    await supabase.from('drivers').update({ status }).eq('id', user.id);
  };

  const acceptRide = async (rideId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('rides')
      .update({ driver_id: user.id, status: 'accepted' })
      .eq('id', rideId)
      .select()
      .single();
    if (data) {
      setCurrentRide(data);
      setPendingRide(null);
    }
  };

  const declineRide = async (rideId: string) => {
    setPendingRide(null);
  };

  const completeRide = async (rideId: string) => {
    await supabase
      .from('rides')
      .update({ status: 'completed' })
      .eq('id', rideId);
    setCurrentRide(null);
    fetchTodayStats();
    fetchProfile();
  };

  const refreshProfile = async () => {
    await fetchProfile();
    await fetchTodayStats();
  };

  return (
    <RideContext.Provider
      value={{
        driverStatus,
        setDriverStatus,
        driverProfile,
        currentRide,
        pendingRide,
        todayEarnings,
        todayRides,
        acceptRide,
        declineRide,
        completeRide,
        refreshProfile,
      }}
    >
      {children}
    </RideContext.Provider>
  );
}

export const useRide = () => useContext(RideContext);
