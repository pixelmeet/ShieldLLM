"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SortingState } from "@tanstack/react-table";
import { ArrowLeft, Loader2, PlusCircle } from "lucide-react";
import { User } from "@/types/user";
import { getUsersAction } from "@/app/actions/admin";
import { DataTable } from "@/components/custom/data-table";
import { getColumns } from "@/app/admin/users/columns";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/components/admin/users/create-user-dialog";
import { EditUserDialog } from "@/components/admin/users/edit-user-dialog";
import { USER_ROLES, UserRole } from "@/types/roles";
import { DeleteUserDialog } from "@/components/admin/users/delete-user-dialog";

export default function ModeratorUsersPage() {
  const router = useRouter();
  const [data, setData] = useState<{ users: User[]; pageCount: number }>({
    users: [],
    pageCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  const [refreshCounter, setRefreshCounter] = useState(0);
  const handleRefresh = () => setRefreshCounter((prev) => prev + 1);

  const [prevFilter, setPrevFilter] = useState("");
  useEffect(() => {
    if (filter !== prevFilter) {
      setPageIndex(0);
      setPrevFilter(filter);
    }
  }, [filter, prevFilter]);

  useEffect(() => {
    setIsLoading(true);
    getUsersAction({
      pageIndex,
      pageSize,
      query: filter,
      sort: sorting[0]
        ? { id: sorting[0].id, desc: sorting[0].desc }
        : undefined,
    }).then((result) => {
      const filtered = result.users.filter((u) => u.role !== USER_ROLES.ADMIN);
      setData({ users: filtered, pageCount: result.pageCount });
      setIsLoading(false);
    });
  }, [pageIndex, filter, sorting, refreshCounter]);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const columns = useMemo(
    () =>
      getColumns(
        (user) => setEditUser(user),
        (user) => setDeleteUser(user)
      ),
    []
  );

  return (
    <main className="min-h-screen bg-secondary p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold font-serif">
            Manage Users & Moderators
          </h1>
        </div>

        {isLoading && !data.users.length ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data.users}
            pageCount={data.pageCount}
            onPageChange={setPageIndex}
            onSortChange={setSorting}
            onFilterChange={setFilter}
            onRefresh={handleRefresh}
            isLoading={isLoading}
            pageIndex={pageIndex}
            pageSize={pageSize}
            sorting={sorting}>
            <Button onClick={() => setCreateUserOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </DataTable>
        )}
      </div>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        allowedRoles={[USER_ROLES.USER, USER_ROLES.MODERATOR] as UserRole[]}
      />
      <EditUserDialog
        user={editUser}
        onOpenChange={() => setEditUser(null)}
        allowedRoles={[USER_ROLES.USER, USER_ROLES.MODERATOR] as UserRole[]}
      />
      <DeleteUserDialog
        user={deleteUser}
        onOpenChange={() => setDeleteUser(null)}
      />
    </main>
  );
}
