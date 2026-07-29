import type { OperationGroup, OperationId } from "@/domain/headscale-operations";
import type { MessageKey } from "./messages";
import type { ProductCopy } from "./product-copy";

export interface LocaleCatalog {
  common: Record<MessageKey, string>;
  groups: Record<OperationGroup, string>;
  operations: Record<OperationId, { title: string; description: string }>;
  product: ProductCopy;
}
