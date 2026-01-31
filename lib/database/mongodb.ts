import { getMongoDb } from "./clients";
import { DatabaseAdapter } from "@/types/database";
import { User } from "@/types/user";

const getUsersCollection = async () => {
  const db = await getMongoDb();
  return db.collection<User>("users");
};

export const MongoDbAdapter: DatabaseAdapter = {
  async findUserByEmail(email) {
    const users = await getUsersCollection();
    const user = await users.findOne({ email: email.toLowerCase() });
    return user ? ({ ...user, _id: undefined } as User) : null;
  },
  async findUserById(id) {
    const users = await getUsersCollection();
    const user = await users.findOne({ id });
    return user ? ({ ...user, _id: undefined } as User) : null;
  },
  async createUser(user) {
    const users = await getUsersCollection();
    const result = await users.insertOne(user);
    return result.acknowledged ? user : null;
  },
  async updateUser(id, userData) {
    const users = await getUsersCollection();
    const result = await users.findOneAndUpdate(
      { id },
      { $set: userData },
      { returnDocument: "after" }
    );
    return result ? ({ ...result, _id: undefined } as User) : null;
  },
  async deleteUserById(id) {
    const users = await getUsersCollection();
    const result = await users.deleteOne({ id });
    return result.deletedCount > 0;
  },
  async getAdminAnalytics() {
    const users = await getUsersCollection();
    const totalUsers = await users.countDocuments();
    const totalAdmins = await users.countDocuments({ role: "admin" });
    const totalModerators = await users.countDocuments({ role: "moderator" });
    return { totalUsers, totalAdmins, totalModerators };
  },
  async getPaginatedUsers({ pageIndex, pageSize, query, sort }) {
    const users = await getUsersCollection();
    const filterQuery: Record<string, unknown> = {};
    if (query) {
      filterQuery.$or = [
        { fullName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }

    const sortQuery: Record<string, 1 | -1> = {};
    if (sort) {
      sortQuery[sort.id] = sort.desc ? -1 : 1;
    } else {
      sortQuery.fullName = 1;
    }

    const totalCount = await users.countDocuments(filterQuery);
    const result = await users
      .find(filterQuery)
      .sort(sortQuery)
      .skip(pageIndex * pageSize)
      .limit(pageSize)
      .toArray();

    const sanitizedUsers = result.map((user) => ({
      ...user,
      _id: undefined,
    })) as User[];

    return {
      users: sanitizedUsers,
      totalCount,
      pageCount: Math.ceil(totalCount / pageSize),
    };
  },
};