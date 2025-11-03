import { startOfDay, subDays, isBefore } from "date-fns";
import supabase from "../lib/supabase";

// Delete all completed todo trees older than N days for the current user
// Mirrors the clear-all logic used in TaskHistoryScreen but runs headless
export async function autoDeleteCompletedTrees(days) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.id) return { deleted: 0 };

    const cutoff = startOfDay(subDays(new Date(), days));

    // Fetch all user tasks (min fields used)
    const { data: tasks, error } = await supabase
      .from("todos")
      .select("id, parent_id, parent_todo_id, state, due_date")
      .eq("user_id", user.id);

    if (error) throw error;
    if (!Array.isArray(tasks) || tasks.length === 0) return { deleted: 0 };

    const toId = (v) => (v !== null && v !== undefined ? String(v) : null);

    // Build maps
    const idToTask = new Map();
    const idToChildren = new Map();
    const idToParent = new Map();
    tasks.forEach((t) => {
      const idStr = toId(t?.id);
      if (!idStr) return;
      idToTask.set(idStr, t);
      idToChildren.set(idStr, []);
    });
    tasks.forEach((t) => {
      const idStr = toId(t?.id);
      const parentStr = toId(t?.parent_id) || toId(t?.parent_todo_id);
      if (!idStr || !parentStr) return;
      if (!idToChildren.has(parentStr)) idToChildren.set(parentStr, []);
      idToChildren.get(parentStr).push(idStr);
      idToParent.set(idStr, parentStr);
    });

    // Candidate tasks: completed and due_date < cutoff
    const candidateIds = new Set();
    tasks.forEach((t) => {
      if (t?.state !== "completed" || !t?.due_date) return;
      const due = startOfDay(new Date(t.due_date));
      if (isBefore(due, cutoff)) {
        const idStr = toId(t.id);
        if (idStr) candidateIds.add(idStr);
      }
    });

    const areAllLeafDescendantsCompleted = (rootIdRaw) => {
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
    };

    // Completed candidates
    const completedCandidateIds = new Set(
      Array.from(candidateIds).filter((id) =>
        areAllLeafDescendantsCompleted(id)
      )
    );

    // Keep only top-most completed nodes
    const hasAncestorInSet = (idStr, set) => {
      let current = idToParent.get(idStr);
      while (current) {
        if (set.has(current)) return true;
        current = idToParent.get(current);
      }
      return false;
    };
    const topLevelRoots = Array.from(completedCandidateIds).filter(
      (id) => !hasAncestorInSet(id, completedCandidateIds)
    );

    // Collect all descendants for deletion
    const collectDescendants = (rootIdStr) => {
      const out = new Set([rootIdStr]);
      const stack = [rootIdStr];
      while (stack.length > 0) {
        const currentId = stack.pop();
        const children = idToChildren.get(currentId) || [];
        for (const child of children) {
          if (!out.has(child)) {
            out.add(child);
            stack.push(child);
          }
        }
      }
      return Array.from(out);
    };

    const idsToDelete = new Set();
    topLevelRoots.forEach((root) => {
      collectDescendants(root).forEach((id) => idsToDelete.add(id));
    });

    if (idsToDelete.size === 0) return { deleted: 0 };

    // Delete in batches to avoid payload limits
    const idsArray = Array.from(idsToDelete);
    const chunkSize = 200;
    let deleted = 0;
    for (let i = 0; i < idsArray.length; i += chunkSize) {
      const chunk = idsArray.slice(i, i + chunkSize);
      const { error: delError, count } = await supabase
        .from("todos")
        .delete({ count: "exact" })
        .in("id", chunk)
        .eq("user_id", user.id);
      if (delError) throw delError;
      deleted += count || 0;
    }

    return { deleted };
  } catch (e) {
    // Swallow errors for background task, return metrics
    return { deleted: 0, error: e?.message };
  }
}
