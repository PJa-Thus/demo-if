// main.js
const API_URL = "https://script.google.com/a/macros/gm.ibaraki-ct.ac.jp/s/AKfycbzLtsj5zGCi2BqeKAWSG-5bGZYvsKFMrrcdCMJJzi_jQj1zP6DHnd5IvM86te1QzhTG/exec";

let currentSeat = null;
let seatMap = {};
let lastAction = null;
let lastScanTime = 0;

async function loadSeatMapFromDrive() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("読み込み失敗");
    const data = await res.json();
    seatMap = data;
    document.getElementById("result").innerText = "☁ Google Driveからデータを復元しました";
    updateTable();
  } catch (err) {
    console.error(err);
    document.getElementById("result").innerText = "❌ Driveからの復元に失敗しました";
  }
}

async function saveSeatMapToDrive() {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seatMap)
    });
    if (!res.ok) throw new Error("保存失敗");
    document.getElementById("result").innerText = "✅ Google Driveに保存しました";
  } catch (err) {
    console.error(err);
    document.getElementById("result").innerText = "❌ Google Driveへの保存に失敗しました";
  }
}

function completeCurrentSeat() {
  if (currentSeat) {
    document.getElementById("result").innerText = `座席「${currentSeat}」の登録を完了しました。`;
    currentSeat = null;
    document.getElementById("completeSeatBtn").style.display = "none";
  }
}

function undoLast() {
  if (lastAction) {
    const { seat, person } = lastAction;
    const people = seatMap[seat];
    if (people && people[people.length - 1] === person) {
      people.pop();
      document.getElementById("result").innerText = `「${person}」の登録を取り消しました。`;
      lastAction = null;
      updateTable();
    }
  }
}

function clearSavedData() {
  if (confirm("保存データをすべて削除しますか？")) {
    localStorage.removeItem("seatMap");
    seatMap = {};
    document.getElementById("result").innerText = "保存されたデータを削除しました。";
    updateTable();
  }
}

function downloadCSV() {
  let csv = "座席ID,生徒ID\n";
  for (const [seat, people] of Object.entries(seatMap)) {
    people.forEach(person => {
      csv += `${seat},${person}\n`;
    });
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "seat_assignment.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function updateTable() {
  const tbody = document.querySelector('#seatTable tbody');
  tbody.innerHTML = '';
  for (const [seat, people] of Object.entries(seatMap)) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="seat" onclick="removeSeat('${seat}')">${seat} ❌</span></td>
      <td>${people.map(p =>
        `<span class="student" onclick="removeStudent('${seat}', '${p}')">${p} ❌</span>`
      ).join(' ')}</td>
    `;
    tbody.appendChild(row);
  }
  localStorage.setItem("seatMap", JSON.stringify(seatMap));
}

function removeStudent(seat, person) {
  const people = seatMap[seat];
  const index = people.indexOf(person);
  if (index !== -1) {
    people.splice(index, 1);
    document.getElementById("result").innerText = `座席「${seat}」から「${person}」を削除しました。`;
    updateTable();
  }
}

function removeSeat(seat) {
  if (confirm(`座席「${seat}」を削除しますか？（生徒もすべて削除されます）`)) {
    delete seatMap[seat];
    document.getElementById("result").innerText = `座席「${seat}」を削除しました。`;
    updateTable();
  }
}

function onScanSuccess(decodedText) {
  const now = Date.now();
  if (now - lastScanTime < 3000) return;
  lastScanTime = now;

  if (!decodedText.startsWith("table") && !decodedText.startsWith("player")) {
    document.getElementById("result").innerText = "QRコードは 'table' または 'player' で始めてください。";
    return;
  }

  if (decodedText.startsWith("table")) {
    currentSeat = decodedText;
    if (!seatMap[currentSeat]) seatMap[currentSeat] = [];
    document.getElementById("result").innerText = `座席「${currentSeat}」を読み取りました。最大6人まで登録可能。`;
    document.getElementById("completeSeatBtn").style.display = "block";
  } else if (decodedText.startsWith("player")) {
    if (!currentSeat) {
      document.getElementById("result").innerText = "最初に座席QR（table〜）を読み取ってください。";
      return;
    }
    const people = seatMap[currentSeat];
    if (people.length >= 6) {
      document.getElementById("result").innerText = `座席「${currentSeat}」は6人までです。`;
      completeCurrentSeat();
    } else if (people.includes(decodedText)) {
      document.getElementById("result").innerText = `「${decodedText}」は既に座席「${currentSeat}」に登録されています。`;
    } else {
      people.push(decodedText);
      lastAction = { seat: currentSeat, person: decodedText };
      document.getElementById("result").innerText = `「${decodedText}」を座席「${currentSeat}」に登録（${people.length}/6）`;
      if (people.length >= 6) {
        document.getElementById("result").innerText += " 上限に達しました。";
        completeCurrentSeat();
      }
      localStorage.setItem("seatMap", JSON.stringify(seatMap));
      updateTable();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedMap = localStorage.getItem("seatMap");
  if (savedMap) {
    seatMap = JSON.parse(savedMap);
    document.getElementById("result").innerText = "📦 ローカル保存データを復元しました";
    updateTable();
  } else {
    loadSeatMapFromDrive();
  }

  const html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start(
    { facingMode: "environment" },
    {
      fps: 15,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.33
    },
    onScanSuccess
  ).catch(err => {
    console.error("カメラ起動エラー:", err);
    document.getElementById("result").innerText = "カメラ起動に失敗しました: " + err;
  });
});
