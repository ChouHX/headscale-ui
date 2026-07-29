import type { HeadscaleNode } from "@/api/types";
import { nodeConnectionStatus } from "@/domain/node-status";
import { hasVisibleUser, userLabel } from "./user";

export function nodeDisplayName(node: HeadscaleNode): string {
  return node.givenName || node.name;
}

/** Routes the node has advertised but the admin hasn't approved yet. */
export function nodePendingRoutes(node: HeadscaleNode): string[] {
  return node.availableRoutes.filter((route) => !node.approvedRoutes.includes(route));
}

/**
 * Owner label for a node, "" if owner is the tag-managed pseudo-user or missing.
 * The fallback string is only used when there is a visible user but no readable name.
 */
export function nodeOwner(node: HeadscaleNode, unknownFallback: string): string {
  if (!hasVisibleUser(node.user)) return "";
  return userLabel(node.user, unknownFallback);
}

export interface NodeStatusLabels {
  online: string;
  offline: string;
  expired: string;
}

export function nodeStatusLabel(node: HeadscaleNode, labels: NodeStatusLabels): string {
  const status = nodeConnectionStatus(node);
  return labels[status];
}
