export interface HeadscaleUser {
  id: string;
  name: string;
  createdAt?: string;
  displayName?: string;
  email?: string;
  providerId?: string;
  provider?: string;
  profilePicUrl?: string;
}

export interface PreAuthKey {
  id: string;
  key: string;
  user?: HeadscaleUser;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration?: string;
  createdAt?: string;
  aclTags: string[];
}

export interface HeadscaleNode {
  id: string;
  machineKey?: string;
  nodeKey?: string;
  discoKey?: string;
  ipAddresses: string[];
  name: string;
  user?: HeadscaleUser;
  lastSeen?: string;
  expiry?: string;
  preAuthKey?: PreAuthKey;
  createdAt?: string;
  registerMethod?: string;
  givenName?: string;
  online: boolean;
  approvedRoutes: string[];
  availableRoutes: string[];
  subnetRoutes: string[];
  tags: string[];
}

export interface ApiKey {
  id: string;
  prefix: string;
  expiration?: string;
  createdAt?: string;
  lastSeen?: string;
}

export interface HealthResponse {
  checkedAt?: string;
  databaseConnectivity: boolean;
  latencyMs?: number;
  serverReachable?: boolean;
}

export interface VersionResponse {
  version: string;
}

export interface PolicyResponse {
  policy: string;
  updatedAt?: string;
}

export interface HeadscaleSnapshot {
  health: HealthResponse | null;
  version: VersionResponse | null;
  users: HeadscaleUser[];
  preAuthKeys: PreAuthKey[];
  nodes: HeadscaleNode[];
  apiKeys: ApiKey[];
  policy: PolicyResponse | null;
}

export type OperationPayload = Record<string, string | boolean | string[] | undefined>;

export interface HeadscaleClient {
  health(): Promise<HealthResponse>;
  version(): Promise<VersionResponse>;
  listUsers(payload: OperationPayload): Promise<{ users: HeadscaleUser[] }>;
  createUser(payload: OperationPayload): Promise<{ user: HeadscaleUser }>;
  renameUser(payload: OperationPayload): Promise<{ user: HeadscaleUser }>;
  deleteUser(payload: OperationPayload): Promise<Record<string, never>>;
  listPreAuthKeys(): Promise<{ preAuthKeys: PreAuthKey[] }>;
  createPreAuthKey(payload: OperationPayload): Promise<{ preAuthKey: PreAuthKey }>;
  expirePreAuthKey(payload: OperationPayload): Promise<Record<string, never>>;
  deletePreAuthKey(payload: OperationPayload): Promise<Record<string, never>>;
  listNodes(payload: OperationPayload): Promise<{ nodes: HeadscaleNode[] }>;
  getNode(payload: OperationPayload): Promise<{ node: HeadscaleNode }>;
  registerNode(payload: OperationPayload): Promise<{ node: HeadscaleNode }>;
  debugCreateNode(payload: OperationPayload): Promise<{ node: HeadscaleNode }>;
  renameNode(payload: OperationPayload): Promise<{ node: HeadscaleNode }>;
  expireNode(payload: OperationPayload): Promise<{ node: HeadscaleNode }>;
  deleteNode(payload: OperationPayload): Promise<Record<string, never>>;
  setTags(payload: OperationPayload): Promise<{ node: HeadscaleNode }>;
  setApprovedRoutes(payload: OperationPayload): Promise<{ node: HeadscaleNode }>;
  backfillNodeIps(payload: OperationPayload): Promise<{ changes: string[] }>;
  listApiKeys(): Promise<{ apiKeys: ApiKey[] }>;
  createApiKey(payload: OperationPayload): Promise<{ apiKey: string }>;
  expireApiKey(payload: OperationPayload): Promise<Record<string, never>>;
  deleteApiKey(payload: OperationPayload): Promise<Record<string, never>>;
  getPolicy(): Promise<PolicyResponse>;
  setPolicy(payload: OperationPayload): Promise<PolicyResponse>;
}
