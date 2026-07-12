/**
 * @description Key 保险箱 API 客户端（云端 D1，按登录用户隔离）。
 * 不再使用 IndexedDB。
 */

import { getToken, authFetch } from '@/stores/authToken';

function normalizeToken(token) {
    return String(token || '').trim();
}

async function parseError(response) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return new Error(err.error || `HTTP ${response.status}`);
}

function assertAuth() {
    if (!getToken()) throw new Error('Unauthorized');
}

export async function getAllKeys() {
    assertAuth();
    const response = await authFetch('/api/keys');
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return Array.isArray(data.keys) ? data.keys : [];
}

export async function getKeyById(id) {
    assertAuth();
    const response = await authFetch(`/api/keys/${encodeURIComponent(id)}`);
    if (response.status === 404) return undefined;
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return data.key;
}

export async function getKeyByToken(token) {
    const normalized = normalizeToken(token);
    if (!normalized) return undefined;
    const keys = await getAllKeys();
    return keys.find((k) => normalizeToken(k.token) === normalized);
}

export async function getKeysByToken(token) {
    const normalized = normalizeToken(token);
    if (!normalized) return [];
    const keys = await getAllKeys();
    return keys.filter((k) => normalizeToken(k.token) === normalized);
}

export async function addKey(record) {
    assertAuth();
    const token = normalizeToken(record.token);
    if (!token) return null;

    const response = await authFetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...record, token }),
    });

    if (response.status === 409) return null;
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return data.key;
}

export async function addKeys(records) {
    assertAuth();
    const response = await authFetch('/api/keys/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
    });
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return Array.isArray(data.keys) ? data.keys : [];
}

export async function updateKey(id, updates) {
    assertAuth();
    const response = await authFetch(`/api/keys/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return data.key;
}

export async function deleteKey(id) {
    assertAuth();
    const response = await authFetch(`/api/keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) throw await parseError(response);
}

export async function addBalanceSnapshot(keyId, balance, currency = 'USD') {
    assertAuth();
    const response = await authFetch(`/api/keys/${encodeURIComponent(keyId)}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance, currency }),
    });
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return data.snapshot;
}

export async function getBalanceSnapshots(keyId) {
    assertAuth();
    const response = await authFetch(`/api/keys/${encodeURIComponent(keyId)}/snapshots`);
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return Array.isArray(data.snapshots) ? data.snapshots : [];
}

export async function getLatestSnapshot(keyId) {
    const snapshots = await getBalanceSnapshots(keyId);
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

export async function exportAllKeys() {
    assertAuth();
    const response = await authFetch('/api/keys/export');
    if (!response.ok) throw await parseError(response);
    const data = await response.json();
    return JSON.stringify(data, null, 2);
}

export async function importKeys(jsonStr, { replace = false } = {}) {
    assertAuth();
    const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    const response = await authFetch('/api/keys/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, replace }),
    });
    if (!response.ok) throw await parseError(response);
    const result = await response.json();
    return result.count || 0;
}

export async function clearAllKeys() {
    const keys = await getAllKeys();
    if (keys.length === 0) return;
    const response = await authFetch('/api/keys/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: keys.map((k) => k.id) }),
    });
    if (!response.ok) throw await parseError(response);
}
