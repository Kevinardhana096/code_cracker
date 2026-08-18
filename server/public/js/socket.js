let socket = null;
let authPayload = null;

function connectSocket() {
  socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    if (authPayload) socket.emit('auth', authPayload);
    const event = new CustomEvent('socket:connected', { detail: { socketId: socket.id } });
    document.dispatchEvent(event);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    const event = new CustomEvent('socket:disconnected', { detail: { reason } });
    document.dispatchEvent(event);
  });

  socket.on('connect_error', (err) => {
    console.log('[Socket] Connection error:', err.message);
    const event = new CustomEvent('socket:error', { detail: { message: err.message } });
    document.dispatchEvent(event);
  });

  return socket;
}

function getSocket() {
  if (!socket) {
    socket = connectSocket();
  }
  return socket;
}

function emit(event, data) {
  const s = getSocket();
  if (event === 'auth') authPayload = data;
  s.emit(event, data);
}

function on(event, handler) {
  const s = getSocket();
  s.on(event, handler);
}

function off(event, handler) {
  const s = getSocket();
  if (handler) {
    s.off(event, handler);
  } else {
    s.off(event);
  }
}
