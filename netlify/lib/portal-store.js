// Storage for the client portal. On Netlify it uses Netlify Blobs (no extra account needed);
// tests use the in-memory version. Keys:
//   clients/{clientId}               client record
//   tokens/{sha256 of access token}  { clientId }
//   tickets/{clientId}/{ticketId}    support, maintenance and Google Ads requests
//   messages/{clientId}/{messageId}  direct messages
import { getStore } from "@netlify/blobs";

export function blobStore(name = "client-portal") {
  let store;
  const s = () => (store ??= getStore({ name, consistency: "strong" }));
  return {
    getJSON: (key) => s().get(key, { type: "json" }),
    setJSON: (key, value) => s().setJSON(key, value),
    delete: (key) => s().delete(key),
    keys: async (prefix) => (await s().list({ prefix })).blobs.map((b) => b.key).sort(),
  };
}

export function memoryStore() {
  const data = new Map();
  return {
    getJSON: async (key) => (data.has(key) ? structuredClone(data.get(key)) : null),
    setJSON: async (key, value) => void data.set(key, structuredClone(value)),
    delete: async (key) => void data.delete(key),
    keys: async (prefix) => [...data.keys()].filter((k) => k.startsWith(prefix)).sort(),
  };
}
