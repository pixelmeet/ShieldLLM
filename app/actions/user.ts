"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/database";
import { getCurrentUserAction, logoutAction } from "./auth";

export async function updateUserNameAction(newName: string) {
  const db = await getDb();
  const user = await getCurrentUserAction();

  if (!user) {
    throw new Error("You must be logged in to update your profile.");
  }

  try {
    await db.updateUser(user.id, { fullName: newName });
    revalidatePath("/user");
    return { success: true, message: "Name updated successfully." };
  } catch (error) {
    console.error("Error updating user name:", error);
    return { success: false, message: "Failed to update name." };
  }
}

export async function updateUserExtrasAction(extras: Record<string, unknown>) {
  const db = await getDb();
  const user = await getCurrentUserAction();

  if (!user) {
    throw new Error("You must be logged in to update your profile.");
  }

  try {
    await db.updateUser(user.id, { ...extras, updated_at: new Date().toISOString() });
    revalidatePath("/user");
    return { success: true, message: "Profile updated successfully." };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { success: false, message: "Failed to update profile." };
  }
}

export async function deleteUserAction() {
  const db = await getDb();
  const user = await getCurrentUserAction();

  if (!user) {
    throw new Error("You must be logged in to delete your account.");
  }

  try {
    const deleted = await db.deleteUserById(user.id);
    if (!deleted) {
      throw new Error("Database deletion failed.");
    }
    await logoutAction();
    return { success: true, message: "Account deleted successfully." };
  } catch (error) {
    console.error("Error deleting user account:", error);
    return { success: false, message: "Failed to delete account." };
  }
}