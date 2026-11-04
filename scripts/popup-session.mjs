// Chrome action popups are not consistently exposed as Playwright Page events.
// Attach to the actual popup target using the browser's DevTools protocol.
export async function attachPopup(cdp, targetId) {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: false });
  const requests = new Map();
  let sequence = 0;
  const receive = (event) => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message);
    const request = requests.get(message.id);
    if (!request) return;
    requests.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  };
  cdp.on('Target.receivedMessageFromTarget', receive);
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { requests.delete(id); reject(new Error(`Popup protocol timeout: ${method}`)); }, 5000);
    requests.set(id, { resolve, reject, timer });
    void cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch((error) => {
      requests.delete(id); clearTimeout(timer); reject(error);
    });
  });
  const evaluate = async (fn, argument) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(argument) ?? ''})`, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error('Popup evaluation failed');
    return result.value;
  };
  return {
    send, evaluate,
    until: async (fn, description) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (await evaluate(fn)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`Popup check failed: ${description}`);
    },
    close: async () => {
      cdp.off('Target.receivedMessageFromTarget', receive);
      for (const request of requests.values()) { clearTimeout(request.timer); request.reject(new Error('Popup closed')); }
      requests.clear();
      await cdp.send('Target.closeTarget', { targetId });
    },
  };
}
