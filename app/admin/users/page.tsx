
"use client";

import { useCallback, useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  role: "creator" | "reviewer" | "admin";
  created_at: string;
};

function getToken(): string {
  const session = localStorage.getItem("bg_session");

  if (!session) return "";

  try {
    const parsed = JSON.parse(session);

    const token =
      parsed.token ||
      parsed.access_token ||
      parsed.accessToken;

    return typeof token === "string" ? token : "";
  } catch {
    return "";
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Session token not found. Please log in again.");
      }

      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }

      if (response.status === 403) {
        throw new Error("Admin access required. Check your account role.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to load users.");
      }

      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function changeRole(userId: string, role: User["role"]) {
    const confirmed = window.confirm(
      `Are you sure you want to change this user's role to ${role}?`
    );

    if (!confirmed) return;

    setSavingId(userId);
    setMessage("");
    setError("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Session token not found. Please log in again.");
      }

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, role }),
      });

      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }

      if (response.status === 403) {
        throw new Error("Admin access required.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to update role.");
      }

      setMessage(data.message || "Role updated successfully.");
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSavingId("");
    }
  }

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total: users.length,
    admins: users.filter((user) => user.role === "admin").length,
    reviewers: users.filter((user) => user.role === "reviewer").length,
    creators: users.filter((user) => user.role === "creator").length,
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <a
              href="/admin"
              className="mb-3 inline-block text-sm text-blue-400 hover:text-blue-300"
            >
              ← Back to Admin Dashboard
            </a>

            <h1 className="text-3xl font-bold">User Management</h1>

            <p className="mt-2 text-sm text-slate-400">
              View registered users and manage their access roles.
            </p>
          </div>

          <button
            onClick={loadUsers}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Users"}
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Total Users", counts.total],
            ["Admins", counts.admins],
            ["Reviewers", counts.reviewers],
            ["Creators", counts.creators],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by email..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
          />
        </div>

        {message && (
          <p className="mb-4 rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-300">
            {message}
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          {loading ? (
            <p className="p-8 text-center text-slate-400">
              Loading users...
            </p>
          ) : filteredUsers.length === 0 ? (
            <p className="p-8 text-center text-slate-400">
              No users found.
            </p>
          ) : (
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Current Role</th>
                  <th className="px-5 py-4">Registered</th>
                  <th className="px-5 py-4">Change Role</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="px-5 py-4 font-medium">
                      {user.email}
                    </td>

                    <td className="px-5 py-4 capitalize">
                      {user.role}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-5 py-4">
                      <select
                        value={user.role}
                        disabled={savingId === user.id}
                        onChange={(e) =>
                          changeRole(
                            user.id,
                            e.target.value as User["role"]
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-50"
                      >
                        <option value="creator">Creator</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                      </select>

                      {savingId === user.id && (
                        <span className="ml-2 text-xs text-slate-400">
                          Saving...
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
