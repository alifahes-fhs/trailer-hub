/* ============================================================
   TRAILER HUB — Watch With Me Server
   Run: node server.js
   ============================================================ */

   const express = require('express');
   const http = require('http');
   const { Server } = require('socket.io');
   const path = require('path');
   
   const app = express();
   const server = http.createServer(app);
   const io = new Server(server, {
     cors: { origin: '*' }
   });
   
   /* ── Serve your existing frontend files ── */
   app.use(express.static(path.join(__dirname, 'public')));
   
   /* ── Track rooms: { roomId: { videoId, state } } ── */
   const rooms = new Map();
   
   function getRoom(roomId) {
     if (!rooms.has(roomId)) {
       rooms.set(roomId, { videoId: null, playing: false, currentTime: 0, updatedAt: Date.now() });
     }
     return rooms.get(roomId);
   }
   
   io.on('connection', (socket) => {
     console.log(`[+] Socket connected: ${socket.id}`);
   
     /* ── Join a room ── */
     socket.on('join-room', ({ roomId }) => {
       socket.join(roomId);
       socket.data.roomId = roomId;
   
       const room = getRoom(roomId);
       const count = io.sockets.adapter.rooms.get(roomId)?.size || 1;
   
       console.log(`[room:${roomId}] ${socket.id} joined (${count} users)`);
   
       /* Send the current room state to the newcomer */
       socket.emit('room-state', { ...room, userCount: count });
   
       /* Notify others someone joined */
       socket.to(roomId).emit('user-joined', { userCount: count });
     });
   
     /* ── Sync: set which video is playing in this room ── */
     socket.on('set-video', ({ roomId, videoId }) => {
       const room = getRoom(roomId);
       room.videoId = videoId;
       room.playing = false;
       room.currentTime = 0;
       room.updatedAt = Date.now();
       io.to(roomId).emit('video-set', { videoId });
     });
   
     /* ── Play ── */
     socket.on('play', ({ roomId, currentTime }) => {
       const room = getRoom(roomId);
       room.playing = true;
       room.currentTime = currentTime ?? room.currentTime;
       room.updatedAt = Date.now();
       /* Broadcast to everyone ELSE in the room */
       socket.to(roomId).emit('play', { currentTime: room.currentTime });
     });
   
     /* ── Pause ── */
     socket.on('pause', ({ roomId, currentTime }) => {
       const room = getRoom(roomId);
       room.playing = false;
       room.currentTime = currentTime ?? room.currentTime;
       room.updatedAt = Date.now();
       socket.to(roomId).emit('pause', { currentTime: room.currentTime });
     });
   
     /* ── Seek ── */
     socket.on('seek', ({ roomId, currentTime }) => {
       const room = getRoom(roomId);
       room.currentTime = currentTime;
       room.updatedAt = Date.now();
       socket.to(roomId).emit('seek', { currentTime });
     });
   
     /* ── Emoji Reaction ── */
     socket.on('reaction', ({ roomId, emoji }) => {
       /* Broadcast reaction to ALL in room including sender */
       io.to(roomId).emit('reaction', { emoji, from: socket.id });
     });
   
     /* ── Disconnect ── */
     socket.on('disconnect', () => {
       const roomId = socket.data.roomId;
       if (roomId) {
         const count = (io.sockets.adapter.rooms.get(roomId)?.size || 0);
         socket.to(roomId).emit('user-left', { userCount: count });
         console.log(`[-] ${socket.id} left room ${roomId} (${count} remaining)`);
       }
     });
   });
   
   const PORT = process.env.PORT || 3000;
   server.listen(PORT, () => {
     console.log(`\n🎬 Trailer Hub Watch Party server running at http://localhost:${PORT}\n`);
   });