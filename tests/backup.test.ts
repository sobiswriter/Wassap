import test from 'node:test';
import assert from 'node:assert/strict';
import authHandler from '../api/gemini/auth';

function createMockReqRes(method: string, url: string, body?: any, cookie?: string, headers: Record<string, string> = {}) {
  const req: any = {
    method,
    url,
    headers: {
      host: 'localhost',
      origin: 'http://localhost',
      cookie: cookie || '',
      ...headers
    },
    body
  };

  let statusCode = 200;
  let responseData = '';
  const resHeaders: Record<string, string> = {};

  const res: any = {
    setHeader: (name: string, val: string) => { resHeaders[name.toLowerCase()] = val; },
    statusCode: 200,
    end: (data?: string) => {
      if (data) responseData = data;
    },
    status: (code: number) => {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json: (obj: any) => {
      responseData = JSON.stringify(obj);
    }
  };

  return { req, res, getResult: () => ({ status: res.statusCode || statusCode, data: responseData ? JSON.parse(responseData) : {} }) };
}

test('backup handler rejects requests with missing or invalid passcode', async () => {
  const { req, res, getResult } = createMockReqRes('GET', '/api/gemini/backup');
  await authHandler(req, res);
  const result = getResult();
  assert.equal(result.status, 401);
  assert.equal(result.data.code, 'LOCKED');
});

test('backup handler allows authorized access with passcode header and saves/retrieves slots', async () => {
  // Use default expected passcode hash or env
  const validPasscode = 'SOBI5959';
  process.env.VERTEX_PASSCODE = validPasscode;

  try {
    // 1. List slots
    const { req: listReq, res: listRes, getResult: getListResult } = createMockReqRes(
      'GET',
      '/api/gemini/backup',
      undefined,
      undefined,
      { 'x-vertex-passcode': validPasscode }
    );
    await authHandler(listReq, listRes);
    const listResult = getListResult();
    assert.equal(listResult.status, 200);
    assert.equal(listResult.data.ok, true);
    assert.ok(Array.isArray(listResult.data.slots));

    // 2. Save a test slot
    const testSlotId = `test_slot_${Date.now()}`;
    const testPayload = {
      chats: [{ id: 'test-chat-1', name: 'Test Persona', messages: [{ id: 'm1', text: 'Hi', sender: 'me' }] }]
    };

    const { req: saveReq, res: saveRes, getResult: getSaveResult } = createMockReqRes(
      'POST',
      '/api/gemini/backup',
      {
        action: 'save',
        slotId: testSlotId,
        title: 'Automated Test Slot',
        payload: testPayload
      },
      undefined,
      { 'x-vertex-passcode': validPasscode }
    );
    await authHandler(saveReq, saveRes);
    const saveResult = getSaveResult();
    assert.equal(saveResult.status, 200);
    assert.equal(saveResult.data.ok, true);
    assert.equal(saveResult.data.slot.id, testSlotId);
    assert.equal(saveResult.data.slot.chatCount, 1);
    assert.equal(saveResult.data.slot.messageCount, 1);

    // 3. Restore the test slot
    const { req: restoreReq, res: restoreRes, getResult: getRestoreResult } = createMockReqRes(
      'GET',
      `/api/gemini/backup?id=${testSlotId}`,
      undefined,
      undefined,
      { 'x-vertex-passcode': validPasscode }
    );
    await authHandler(restoreReq, restoreRes);
    const restoreResult = getRestoreResult();
    assert.equal(restoreResult.status, 200);
    assert.equal(restoreResult.data.ok, true);
    assert.equal(restoreResult.data.slot.id, testSlotId);
    assert.equal(restoreResult.data.slot.payload.chats[0].name, 'Test Persona');

    // 4. Delete the test slot
    const { req: deleteReq, res: deleteRes, getResult: getDeleteResult } = createMockReqRes(
      'DELETE',
      `/api/gemini/backup?id=${testSlotId}`,
      undefined,
      undefined,
      { 'x-vertex-passcode': validPasscode }
    );
    await authHandler(deleteReq, deleteRes);
    const deleteResult = getDeleteResult();
    assert.equal(deleteResult.status, 200);
    assert.equal(deleteResult.data.ok, true);

    // 5. Verify path traversal / invalid slot ID rejection
    const { req: invalidReq, res: invalidRes, getResult: getInvalidResult } = createMockReqRes(
      'GET',
      '/api/gemini/backup?id=////',
      undefined,
      undefined,
      { 'x-vertex-passcode': validPasscode }
    );
    await authHandler(invalidReq, invalidRes);
    assert.equal(getInvalidResult().status, 400);

    const { req: missingReq, res: missingRes, getResult: getMissingResult } = createMockReqRes(
      'GET',
      '/api/gemini/backup?id=nonexistent_slot_12345',
      undefined,
      undefined,
      { 'x-vertex-passcode': validPasscode }
    );
    await authHandler(missingReq, missingRes);
    assert.equal(getMissingResult().status, 404);
  } finally {
    delete process.env.VERTEX_PASSCODE;
  }
});
