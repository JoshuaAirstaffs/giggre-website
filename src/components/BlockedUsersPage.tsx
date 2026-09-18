"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, UserX } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppSelector } from "@/store/hooks";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "@/lib/blocked-users";

// Shared between /app/host/blocked-users and /app/worker/blocked-users — a
// block is a property of the account, not a role, so both routes render this
// same component (see documents/notifications/settings for the pattern).
export default function BlockedUsersPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fetched = await fetchBlockedUsers(uid);
        if (!cancelled) setUsers(fetched);
      } catch (err) {
        console.error("Failed to load blocked users:", err);
        if (!cancelled) setError("Couldn't load your blocked users. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function handleUnblock() {
    if (!uid || !unblockTarget || unblocking) return;
    setUnblocking(true);
    try {
      await unblockUser(uid, unblockTarget.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== unblockTarget.uid));
      toast.success(`${unblockTarget.name} has been unblocked`);
      setUnblockTarget(null);
    } catch (err) {
      console.error("Failed to unblock user:", err);
      toast.error("Couldn't unblock this user. Please try again.");
    } finally {
      setUnblocking(false);
    }
  }

  return (
    <JoshDiv>
      <TitlePage title="Blocked Users" description="People you've blocked can't message you or see your gigs" />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : users.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <ShieldOff className="size-8 text-muted" />
            <p className="text-sm font-medium text-ink">No blocked users</p>
            <p className="max-w-sm text-sm text-muted">
              Users you block from a profile drawer will show up here.
            </p>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Giggre ID</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.uid} className="hover:bg-transparent">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarImage src={user.photoUrl || undefined} alt={user.name} />
                            <AvatarFallback className="bg-muted text-xs font-semibold">
                              {user.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-ink">{user.name}</span>
                            {user.isVerified && <ShieldCheck className="size-3.5 text-(--success-start)" />}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted">{user.userId || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setUnblockTarget(user)}>
                          <UserX className="size-3.5" />
                          Unblock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={unblockTarget !== null} onOpenChange={(open) => !open && !unblocking && setUnblockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock {unblockTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be able to see your gigs and contact you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unblocking}>Cancel</AlertDialogCancel>
            <Button onClick={handleUnblock} disabled={unblocking}>
              {unblocking ? "Unblocking…" : "Unblock"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </JoshDiv>
  );
}
