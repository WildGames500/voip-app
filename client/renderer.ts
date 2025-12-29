const socket = new WebSocket("wss://voip-app-production.up.railway.app");

declare const supabase: any;  // This tells TypeScript "trust me, it exists"
/// <reference lib="dom" />

let localStream: MediaStream | null = null;
let myId: string | null = null;
let myName = "User";  // Will be set from Supabase
let room = "main";
let joined = false;

const peers: Record<string, RTCPeerConnection> = {};
const users: Record<string, { card: HTMLDivElement; audio?: HTMLAudioElement; indicator: HTMLDivElement }> = {};

const voiceUsers = document.getElementById("voiceUsers") as HTMLDivElement;
const previewUsers = document.getElementById("previewUsers") as HTMLDivElement;
const connectionStatus = document.getElementById("connectionStatus") as HTMLDivElement;

const muteBtn = document.getElementById("muteBtn") as HTMLButtonElement;
const deafenBtn = document.getElementById("deafenBtn") as HTMLButtonElement;
const pttBtn = document.getElementById("pttBtn") as HTMLButtonElement;
const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;

let muted = false;
let deafened = false;
let pttEnabled = false;
let holdingPTT = false;

const PTT_KEY = "v";

let previewInterval: number | null = null;
let joinedInterval: number | null = null;

/* ---------------- SOCKET ---------------- */

socket.addEventListener("open", () => {
  connectionStatus.textContent = "✅ Connected to voice server";
  connectionStatus.style.color = "#3ba55c";

  // Start live preview polling immediately
  socket.send(JSON.stringify({ type: "get-users" }));
  previewInterval = window.setInterval(() => {
    socket.send(JSON.stringify({ type: "get-users" }));
  }, 2000);
});

socket.onmessage = async (e) => {
  const msg = JSON.parse(e.data);
  console.log("[WS Received]", msg);

  switch (msg.type) {
    case "you-are":
      myId = msg.id;
      break;

    case "room-users":
      if (!joined) {
        previewUsers.innerHTML = "<strong>In Voice:</strong><br>";
        msg.users.forEach((u: { id: string; name: string }) => {
          if (u.id !== myId) {
            const div = document.createElement("div");
            div.textContent = u.name;
            previewUsers.appendChild(div);
          }
        });
      } else {
        msg.users.forEach((u: { id: string; name: string }) => {
          if (u.id !== myId && !users[u.id]) {
            createUserCard(u.id, u.name);
            createPeer(u.id, u.name);
          }
        });
      }
      break;

    case "user-joined":
      if (msg.id !== myId && joined) {
        createUserCard(msg.id, msg.name);
        createPeer(msg.id, msg.name);
      }
      break;

    case "user-left":
      removeUser(msg.id);
      break;

    case "signal":
      await handleSignal(msg.from, msg.data);
      break;
  }
};

/* ---------------- JOIN VOICE ---------------- */

function joinVoiceChannel(username: string) {
  myName = username;

  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  }).then(stream => {
    localStream = stream;
    createUserCard("self", myName);
    setupLocalVoiceActivity(users["self"].indicator);

    previewUsers.style.display = "none";

    socket.send(JSON.stringify({ type: "join", room, name: myName }));

    // Switch polling frequency after join
    if (previewInterval) clearInterval(previewInterval);
    joinedInterval = window.setInterval(() => {
      socket.send(JSON.stringify({ type: "get-users" }));
    }, 5000);

    joined = true;
  }).catch(err => {
    alert("Mic access denied: " + err.message);
  });
}

/* ---------------- CLEANUP ---------------- */

window.addEventListener("unload", () => {
  if (previewInterval) clearInterval(previewInterval);
  if (joinedInterval) clearInterval(joinedInterval);
});

/* ---------------- PEER ---------------- */

function createPeer(id: string, name: string) {
  if (peers[id]) return;

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  peers[id] = pc;

  const isCaller = myId! < id;

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream!));
  }

  pc.ontrack = (event: RTCTrackEvent) => {
    const stream = event.streams[0];
    if (users[id].audio) {
      users[id].audio!.srcObject = stream;
      users[id].audio!.muted = deafened;
    }
    setupVoiceActivity(stream, users[id].indicator);
  };

  pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      socket.send(JSON.stringify({
        type: "signal",
        to: id,
        data: { candidate: event.candidate }
      }));
    }
  };

  pc.onnegotiationneeded = async () => {
    if (!isCaller) return;

    try {
      await pc.setLocalDescription(await pc.createOffer());
      socket.send(JSON.stringify({
        type: "signal",
        to: id,
        data: { sdp: pc.localDescription }
      }));
    } catch (err) {
      console.error("Offer error:", err);
    }
  };
}

async function handleSignal(fromId: string, data: any): Promise<void> {
  let pc = peers[fromId];
  if (!pc) {
    createPeer(fromId, "Unknown");
    pc = peers[fromId];
  }

  try {
    if (data.sdp) {
      const desc = new RTCSessionDescription(data.sdp);
      await pc.setRemoteDescription(desc);

      if (desc.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.send(JSON.stringify({
          type: "signal",
          to: fromId,
          data: { sdp: answer }
        }));
      }
    } else if (data.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (err) {
    console.error("Signal error:", err);
  }
}

/* ---------------- UI ---------------- */

function createUserCard(id: string, name: string) {
  if (users[id]) return;

  const card = document.createElement("div");
  card.className = "user-card";

  const indicator = document.createElement("div");
  indicator.className = "indicator";

  const label = document.createElement("span");
  label.textContent = name + (id === "self" ? " (You)" : "");

  card.append(indicator, label);
  voiceUsers.appendChild(card);

  let audio: HTMLAudioElement | undefined;
  if (id !== "self") {
    audio = document.createElement("audio");
    audio.autoplay = true;
    audio.muted = deafened;
    document.body.appendChild(audio);
  }

  users[id] = { card, audio, indicator };
}

function removeUser(id: string) {
  if (peers[id]) {
    peers[id].close();
    delete peers[id];
  }
  if (users[id]) {
    users[id].card.remove();
    users[id].audio?.remove();
    delete users[id];
  }
}

/* ---------------- VOICE ACTIVITY ---------------- */

function setupLocalVoiceActivity(indicator: HTMLDivElement) {
  if (!localStream) return;

  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(localStream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const detect = () => {
    analyser.getByteFrequencyData(dataArray);
    const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
    indicator.classList.toggle("speaking", volume > 20);
    requestAnimationFrame(detect);
  };
  detect();
}

function setupVoiceActivity(stream: MediaStream, indicator: HTMLDivElement) {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const detect = () => {
    analyser.getByteFrequencyData(dataArray);
    const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
    indicator.classList.toggle("speaking", volume > 18);
    requestAnimationFrame(detect);
  };
  detect();
}

/* ---------------- CONTROLS ---------------- */

function updateMicState() {
  if (!localStream) return;
  const shouldSend = !muted && (!pttEnabled || holdingPTT);
  localStream.getAudioTracks().forEach(track => track.enabled = shouldSend);
}

function updateDeafenState() {
  Object.values(users).forEach(u => {
    if (u.audio) u.audio.muted = deafened;
  });
}

muteBtn.onclick = () => {
  muted = !muted;
  muteBtn.textContent = muted ? "Unmute" : "Mute";
  muteBtn.style.backgroundColor = muted ? "red" : "";
  updateMicState();
};

deafenBtn.onclick = () => {
  deafened = !deafened;
  updateDeafenState();
  deafenBtn.textContent = deafened ? "Undeafen" : "Deafen";
  deafenBtn.style.backgroundColor = deafened ? "red" : "";
};

pttBtn.onclick = () => {
  pttEnabled = !pttEnabled;
  pttBtn.textContent = pttEnabled ? "PTT: ON (Hold V)" : "PTT: OFF";
  updateMicState();
};

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.reload();  // Refresh to show login screen again
};

document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === PTT_KEY && pttEnabled && !holdingPTT) {
    holdingPTT = true;
    updateMicState();
  }
});

document.addEventListener("keyup", e => {
  if (e.key.toLowerCase() === PTT_KEY && pttEnabled && holdingPTT) {
    holdingPTT = false;
    updateMicState();
  }
});