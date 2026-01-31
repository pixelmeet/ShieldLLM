import { getSupabaseClient } from "./clients";
import { DatabaseAdapter } from "@/types/database";
import { User } from "@/types/user";

export const SupabaseAdapter: DatabaseAdapter = {
  async findUserByEmail(email) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();
    if (error && error.code !== "PGRST116") console.error(error);
    return data as User | null;
  },
  async findUserById(id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") console.error(error);
    return data as User | null;
  },
  async createUser(user) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .insert(user)
      .select()
      .single();
    if (error) console.error(error);
    return data as User | null;
  },
  async updateUser(id, userData) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .update(userData)
      .eq("id", id)
      .select()
      .single();
    if (error) console.error(error);
    return data as User | null;
  },
  async deleteUserById(id) {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) console.error(error);
    return !error;
  },
  async getAdminAnalytics() {
    const supabase = await getSupabaseClient();
    const { count: totalUsers, error: totalError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    const { count: totalAdmins, error: adminError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    const { count: totalModerators, error: modError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "moderator");
    if (totalError || adminError || modError)
      console.error(totalError || adminError || modError);
    return {
      totalUsers: totalUsers ?? 0,
      totalAdmins: totalAdmins ?? 0,
      totalModerators: totalModerators ?? 0,
    };
  },
  async getPaginatedUsers({ pageIndex, pageSize, query, sort }) {
    const supabase = await getSupabaseClient();
    let queryBuilder = supabase.from("users").select("*", { count: "exact" });

    if (query) {
      queryBuilder = queryBuilder.or(
        `fullName.ilike.%${query}%,email.ilike.%${query}%`
      );
    }
    if (sort) {
      queryBuilder = queryBuilder.order(sort.id, { ascending: !sort.desc });
    }

    const { data, error, count } = await queryBuilder.range(
      pageIndex * pageSize,
      (pageIndex + 1) * pageSize - 1
    );
    if (error) console.error(error);

    return {
      users: (data as User[]) ?? [],
      totalCount: count ?? 0,
      pageCount: count ? Math.ceil(count / pageSize) : 0,
    };
  },
};