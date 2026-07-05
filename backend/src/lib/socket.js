import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// we will use this function to check if the user is online or not
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// this is for storig online users
const userSocketMap = {}; // {userId:socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.user.fullName);

  const userId = socket.userId;
  
  // Check if user was already connected (reconnecting)
  const wasAlreadyOnline = userSocketMap[userId];
  
  // Update the socket mapping with new socket ID
  userSocketMap[userId] = socket.id;

  // Only broadcast online users if this is a new connection (not a reconnection)
  // Reconnections should update silently without showing as offline then online
  if (!wasAlreadyOnline) {
    console.log("New user online:", socket.user.fullName);
  } else {
    console.log("User reconnected:", socket.user.fullName);
  }

  // Emit online users to all clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // with socket.on we listen for events from clients
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);
    
    // Add a small delay before removing from online list
    // This prevents quick reconnections from showing as offline
    setTimeout(() => {
      // Only remove if this socket ID matches (no reconnection happened)
      if (userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
        console.log("User fully disconnected:", socket.user.fullName);
      }
    }, 1000); // 1 second delay
  });
});

export { io, app, server };
