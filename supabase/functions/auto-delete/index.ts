// Supabase Edge Function: auto-delete
// Deletes completed todo trees older than user-configured retention (days).
// If user disabled, enforce 365-day retention automatically.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Env (set as Function Secrets in Dashboard): PROJECT_URL, SERVICE_ROLE_KEY
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});
const toId = (v) => (v !== null && v !== undefined ? String(v) : null);
async function fetchAllUsers() {
  // Use auth.admin to list users in pages
  const users = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });
    if (error) throw error;
    if (!data?.users?.length) break;
    users.push(
      ...data.users.map((u) => ({
        id: u.id,
      }))
    );
    if (data.users.length < pageSize) break;
    page += 1;
  }
  return users;
}
async function fetchUserMeta(userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  const meta = data?.user?.user_metadata || {};
  const enabled = meta.autoDeleteEnabled !== false; // default enabled
  const days = Math.min(Number(meta.autoDeleteDays) || 30, 365);
  return {
    enabled,
    days,
  };
}
async function fetchUserTasks(userId) {
  const { data, error } = await admin
    .from("todos")
    .select("id, parent_todo_id, state, due_date")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}
function buildMaps(tasks) {
  const idToTask = new Map();
  const idToChildren = new Map();
  const idToParent = new Map();
  tasks.forEach((t) => {
    const id = toId(t?.id);
    if (!id) return;
    idToTask.set(id, t);
    idToChildren.set(id, []);
  });
  tasks.forEach((t) => {
    const id = toId(t?.id);
    const parent = toId(t?.parent_todo_id);
    if (!id || !parent) return;
    if (!idToChildren.has(parent)) idToChildren.set(parent, []);
    idToChildren.get(parent).push(id);
    idToParent.set(id, parent);
  });
  return {
    idToTask,
    idToChildren,
    idToParent,
  };
}
function areAllLeafDescendantsCompleted(rootIdRaw, maps) {
  const { idToTask, idToChildren } = maps;
  const rootId = toId(rootIdRaw);
  if (!rootId || !idToTask.has(rootId)) return false;
  const stack = [rootId];
  while (stack.length > 0) {
    const currentId = stack.pop();
    const children = idToChildren.get(currentId) || [];
    if (children.length === 0) {
      const leaf = idToTask.get(currentId);
      if (!leaf || leaf.state !== "completed") return false;
    } else {
      for (const childId of children) stack.push(childId);
    }
  }
  return true;
}
function collectDescendants(rootId, idToChildren) {
  const out = new Set([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop();
    const children = idToChildren.get(current) || [];
    for (const child of children) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return Array.from(out);
}
serve(async (req) => {
  try {
    // Optional: accept ?userId= to process a single user for testing
    const url = new URL(req.url);
    const singleUser = url.searchParams.get("userId");
    const users = singleUser
      ? [
          {
            id: singleUser,
          },
        ]
      : await fetchAllUsers();
    let totalDeleted = 0;
    for (const u of users) {
      try {
        const meta = await fetchUserMeta(u.id);
        // If disabled, enforce 365-day retention
        const days = meta.enabled ? meta.days : 365;
        const tasks = await fetchUserTasks(u.id);
        if (!tasks.length) continue;
        const { idToTask, idToChildren, idToParent } = buildMaps(tasks);
        // Candidates: completed with due_date older than cutoff
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - days);
        // Identify completed root tasks (no parent) older than cutoff
        // If root is completed, we know all children are completed (enforced in app)
        const completedRootIds = new Set();
        for (const t of tasks) {
          if (t?.state !== "completed" || !t?.due_date) continue;
          const parentStr = toId(t?.parent_todo_id);
          // If no parent, it's a root
          if (!parentStr) {
            const due = new Date(t.due_date);
            due.setHours(0, 0, 0, 0);
            if (due < cutoff) {
              const id = toId(t.id);
              if (id) completedRootIds.add(id);
            }
          }
        }
        // Also include non-root completed tasks that pass leaf verification
        // (for cases where parent isn't completed but the subtree is fully completed)
        const candidateIds = new Set();
        for (const t of tasks) {
          if (t?.state !== "completed" || !t?.due_date) continue;
          const parentStr = toId(t?.parent_todo_id);
          // Skip roots (already handled above) and tasks that are descendants of completed roots
          if (!parentStr) continue;
          const due = new Date(t.due_date);
          due.setHours(0, 0, 0, 0);
          if (due < cutoff) {
            const id = toId(t.id);
            if (id) candidateIds.add(id);
          }
        }
        // For non-root candidates, verify leaf completion
        const verifiedNonRootIds = new Set(
          Array.from(candidateIds).filter((id) => {
            // Skip if this task is a descendant of a completed root (already handled)
            let cur = idToParent.get(id);
            while (cur) {
              if (completedRootIds.has(cur)) return false;
              cur = idToParent.get(cur);
            }
            // Verify leaf completion for non-root tasks
            return areAllLeafDescendantsCompleted(id, {
              idToTask,
              idToChildren,
            });
          })
        );
        // Combine root IDs and verified non-root IDs
        const allCompletedCandidateIds = new Set();
        completedRootIds.forEach((id) => allCompletedCandidateIds.add(id));
        verifiedNonRootIds.forEach((id) => allCompletedCandidateIds.add(id));
        // Keep only top-most nodes (no ancestor in the set)
        const hasAncestor = (id, set) => {
          let cur = idToParent.get(id);
          while (cur) {
            if (set.has(cur)) return true;
            cur = idToParent.get(cur);
          }
          return false;
        };
        const topLevelRoots = Array.from(allCompletedCandidateIds).filter(
          (id) => !hasAncestor(id, allCompletedCandidateIds)
        );
        // Collect all descendants for deletion
        const idsToDelete = new Set();
        for (const r of topLevelRoots) {
          collectDescendants(r, idToChildren).forEach((id) =>
            idsToDelete.add(id)
          );
        }
        if (idsToDelete.size === 0) {
          console.log(
            `User ${
              u.id
            }: No tasks to delete (retention: ${days} days, cutoff: ${cutoff.toISOString()}, completed roots: ${
              completedRootIds.size
            }, verified non-roots: ${verifiedNonRootIds.size})`
          );
          continue;
        }
        console.log(
          `User ${u.id}: Deleting ${idsToDelete.size} tasks (${topLevelRoots.length} root(s))`
        );
        const idsArray = Array.from(idsToDelete);
        const chunkSize = 200;
        for (let i = 0; i < idsArray.length; i += chunkSize) {
          const chunk = idsArray.slice(i, i + chunkSize);
          const { error, count } = await admin
            .from("todos")
            .delete({
              count: "exact",
            })
            .in("id", chunk)
            .eq("user_id", u.id);
          if (error) throw error;
          totalDeleted += count || 0;
        }
      } catch (err) {
        console.error(`Error processing user ${u.id}:`, err);
        // Continue with other users
      }
    }
    return new Response(
      JSON.stringify({
        ok: true,
        deleted: totalDeleted,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: e?.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});
