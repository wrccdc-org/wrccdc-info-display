// Shown when we can't reach Quotient at all
const connectionMessages = [
  "wasabi broke me",
  "contact dex if you see this",
  "have you tried turning it off and on again",
  "the scoreboard is in another castle",
  "404: scores not found",
  "establishing secure connection to the mainframe...",
  "the intern unplugged the server",
  "it works on my machine",
  "blaming DNS as usual",
  "reticulating splines",
  "this is fine",
];
let connectionIndex = 0;

// Shown when Quotient is up but competition hasn't started
const waitingMessages = [
  "competition hasn't started yet, sit tight",
  "blue team is still getting coffee",
  "red team is sharpening their keyboards",
  "the bits aren't ready yet",
  "competition starts soon, try not to panic",
  "pre-gaming the firewall configs",
  "loading cyber ammunition...",
  "waiting for someone to press the big red button",
  "the packets are still in the mail",
  "scoreboard is warming up, please stand by",
];
let waitingIndex = 0;

async function init() {
  const config = await fetch("/api/config").then((r) => r.json());
  const url = config.quotientPublicUrl.replace(/^https?:\/\//, "") + "/graphs";
  document.getElementById("scoreboard-url").textContent = url;

  updateClock();
  setInterval(updateClock, 1000);

  fetchServiceStatus();
  setInterval(fetchServiceStatus, 30000);
}

function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit", second: "2-digit" }
  );
  document.getElementById("date").textContent = now.toLocaleDateString(
    [],
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );
}

async function fetchServiceStatus() {
  try {
    const res = await fetch("/api/quotient/graphs/services");

    if (res.status === 403) {
      const msg = waitingMessages[waitingIndex % waitingMessages.length];
      waitingIndex++;
      showIdleState(msg);
      return;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    renderServiceGrid(data);
  } catch {
    const msg = connectionMessages[connectionIndex % connectionMessages.length];
    connectionIndex++;
    showIdleState(msg);
  }
}

function showIdleState(msg) {
  document.getElementById("status-grid").innerHTML =
    `<div class="no-data">${msg}</div>`;
  document.getElementById("scoreboard-url").style.display = "none";
  document.getElementById("last-updated").style.display = "none";
}

function renderServiceGrid(data) {
  const grid = document.getElementById("status-grid");
  const series = data.series;

  if (!series || series.length === 0) {
    const msg = waitingMessages[waitingIndex % waitingMessages.length];
    waitingIndex++;
    showIdleState(msg);
    return;
  }

  // Show footer info when we have data
  document.getElementById("scoreboard-url").style.display = "";
  document.getElementById("last-updated").style.display = "";

  // Collect all service names from across all teams, sorted alphabetically
  const serviceNames = [
    ...new Set(series.flatMap((team) => team.Data.map((d) => d.X))),
  ].sort();

  // Sort teams by ID for consistent numbering
  const sorted = [...series].sort((a, b) => a.ID - b.ID);

  // Teams as rows, services as columns (no service names in header)
  let html = "<table><tbody>";

  for (let i = 0; i < sorted.length; i++) {
    const team = sorted[i];
    const statusMap = Object.fromEntries(team.Data.map((d) => [d.X, d.Y]));

    html += "<tr>";
    html += `<td class="team-name">${team.Name}</td>`;
    for (const svc of serviceNames) {
      const val = statusMap[svc];
      if (val === 1) {
        html += '<td class="status-up">\u25B2</td>';
      } else if (val === 2) {
        html += '<td class="status-down">\u25BC</td>';
      } else {
        html += '<td class="status-unknown">—</td>';
      }
    }
    html += "</tr>";
  }

  html += "</tbody></table>";
  grid.innerHTML = html;

  document.getElementById("last-updated").textContent =
    `Last updated: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

init();
