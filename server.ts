import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";

interface Client {
  id: string;
  socket: WebSocket;
  room?: string;  // Optional until join
  name?: string;
}

const wss = new WebSocketServer({ port: 3001 });
const clients = new Map<string, Client>();

console.log("✅ Signaling server running on ws://localhost:3001");

// Helper: Broadcast to all clients in a room
function broadcastToRoom(room: string, message: object, excludeId?: string) {
  for (const client of clients.values()) {
    if (client.room === room && client.id !== excludeId && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }
}

// Broadcast updated user list to everyone in the room
function broadcastRoomUsers(room: string) {
  const users = Array.from(clients.values())
    .filter(c => c.room === room)
    .map(c => ({ id: c.id, name: c.name || "Anonymous" }));

  const message = { type: "room-users", users };
  broadcastToRoom(room, message);
}

wss.on("connection", (ws: WebSocket) => {
  // Assign ID immediately on connection
  const clientId = uuidv4();
  const client: Client = {
    id: clientId,
    socket: ws,
  };
  clients.set(clientId, client);

  // Tell the client their ID right away
  ws.send(JSON.stringify({ type: "you-are", id: clientId }));

  console.log(`New client connected (${clientId})`);

  ws.on("message", (rawMessage) => {
    let data;
    try {
      data = JSON.parse(rawMessage.toString());
    } catch (err) {
      console.error("Invalid JSON received:", rawMessage.toString());
      return;
    }

    switch (data.type) {
      case "join": {
        if (client.room) {
          ws.close(1008, "Already joined");
          return;
        }

        if (!data.room || !data.name) {
          ws.close(1008, "Missing room or name");
          return;
        }

        client.room = data.room;
        client.name = data.name.trim() || "Anonymous";

        broadcastToRoom(data.room, { type: "user-joined", id: clientId, name: client.name });
        broadcastRoomUsers(data.room);

        console.log(`User ${client.name} (${clientId}) joined room "${data.room}"`);
        break;
      }

      case "get-users": {
        // Always return list for "main" room (preview works even before join)
        const users = Array.from(clients.values())
          .filter(c => c.room === "main")
          .map(c => ({ id: c.id, name: c.name || "Anonymous" }));

        ws.send(JSON.stringify({ type: "room-users", users }));
        break;
      }

      case "signal": {
        const targetClient = clients.get(data.to);
        if (targetClient && targetClient.socket.readyState === WebSocket.OPEN) {
          targetClient.socket.send(JSON.stringify({
            type: "signal",
            from: clientId,
            data: data.data,
          }));
        }
        break;
      }

      default:
        console.warn("Unknown message type:", data.type);
    }
  });

  ws.on("close", () => {
    if (client.room) {
      broadcastToRoom(client.room, { type: "user-left", id: clientId });
      broadcastRoomUsers(client.room);
    }

    clients.delete(clientId);
    console.log(`Client disconnected (${clientId})`);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  wss.close();
  process.exit(0);
});