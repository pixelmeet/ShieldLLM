import { getFirebaseAdmin } from "./clients";
import { DatabaseAdapter } from "@/types/database";
import { User } from "@/types/user";

const getUsersCollection = async () => {
  const admin = await getFirebaseAdmin();
  return admin.firestore().collection("users");
};

export const FirebaseAdapter: DatabaseAdapter = {
  async findUserByEmail(email) {
    const usersCollection = await getUsersCollection();
    const snapshot = await usersCollection
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as User;
  },
  async findUserById(id) {
    const usersCollection = await getUsersCollection();
    const snapshot = await usersCollection.where("id", "==", id).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as User;
  },
  async createUser(user) {
    const usersCollection = await getUsersCollection();
    await usersCollection.doc(user.id).set(user);
    return user;
  },
  async updateUser(id, userData) {
    const usersCollection = await getUsersCollection();
    const docRef = usersCollection.doc(id);
    await docRef.update(userData);
    const updatedDoc = await docRef.get();
    return updatedDoc.exists ? (updatedDoc.data() as User) : null;
  },
  async deleteUserById(id) {
    try {
      const usersCollection = await getUsersCollection();
      await usersCollection.doc(id).delete();
      return true;
    } catch (error) {
      console.error("Firebase delete error:", error);
      return false;
    }
  },
  async getAdminAnalytics() {
    const usersCollection = await getUsersCollection();

    const totalUsersSnapshot = await usersCollection.count().get();
    const totalAdminsSnapshot = await usersCollection
      .where("role", "==", "admin")
      .count()
      .get();
    const totalModeratorsSnapshot = await usersCollection
      .where("role", "==", "moderator")
      .count()
      .get();
    return {
      totalUsers: totalUsersSnapshot.data().count,
      totalAdmins: totalAdminsSnapshot.data().count,
      totalModerators: totalModeratorsSnapshot.data().count,
    };
  },
  async getPaginatedUsers({ pageIndex, pageSize, query, sort }) {
    const usersCollection = await getUsersCollection();

    const snapshot = await usersCollection.get();
    let allUsers = snapshot.docs.map((doc) => doc.data() as User);

    if (query) {
      const lowercasedQuery = query.toLowerCase();
      allUsers = allUsers.filter(
        (user) =>
          user.fullName.toLowerCase().includes(lowercasedQuery) ||
          user.email.toLowerCase().includes(lowercasedQuery)
      );
    }

    if (sort) {
      type SortableKeys = keyof User;
      const sortKey = sort.id as SortableKeys;
      allUsers.sort((a, b) => {
        const valA = a[sortKey] as unknown as string | number | undefined;
        const valB = b[sortKey] as unknown as string | number | undefined;
        if (valA === undefined || valB === undefined) return 0;
        if (valA < valB) return sort.desc ? 1 : -1;
        if (valA > valB) return sort.desc ? -1 : 1;
        return 0;
      });
    }

    const totalCount = allUsers.length;
    const paginatedUsers = allUsers.slice(
      pageIndex * pageSize,
      (pageIndex + 1) * pageSize
    );

    return {
      users: paginatedUsers,
      totalCount,
      pageCount: Math.ceil(totalCount / pageSize),
    };
  },
};