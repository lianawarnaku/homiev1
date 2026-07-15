import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type Household = {
  id: string;
  name: string;
  housing_type: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string;
  role: string;
  avatar_color: string | null;
  joined_at: string;
};

type HouseholdContextType = {
  household: Household | null;
  members: HouseholdMember[];
  myMembership: HouseholdMember | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextType>({
  household: null,
  members: [],
  myMembership: null,
  loading: true,
  refresh: async () => {},
});

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [myMembership, setMyMembership] = useState<HouseholdMember | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setMembers([]);
      setMyMembership(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Find the user's membership + their household in one query
      const { data: membership } = await supabase
        .from("household_members")
        .select("*, households(*)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        setHousehold(null);
        setMyMembership(null);
        setMembers([]);
        return;
      }

      const h = membership.households as unknown as Household;
      setHousehold(h);
      setMyMembership(membership as HouseholdMember);

      // Fetch the full roster
      const { data: roster } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", h.id)
        .order("joined_at");

      setMembers((roster as HouseholdMember[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  return (
    <HouseholdContext.Provider value={{ household, members, myMembership, loading, refresh }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export const useHousehold = () => useContext(HouseholdContext);
