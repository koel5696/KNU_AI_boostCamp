import "./styles.css";

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
const waterApiUrl = "https://api.ivl.is/hangangtemp/";
const latestLottoApiUrl = "https://smok95.github.io/lotto/results/latest.json";

const hasFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([key]) => key !== "measurementId")
  .every(([, value]) => Boolean(value));

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();
const guestbookCollection = db ? collection(db, "guestbook") : null;
let currentUser = null;
let unsubscribeGuestbook = null;

const numbersEl = document.querySelector("#numbers");
const bonusEl = document.querySelector("#bonus");
const historyEl = document.querySelector("#history");
const button = document.querySelector("#generateButton");
const fixedNumbersInput = document.querySelector("#fixedNumbersInput");
const fixedNumbersChipsEl = document.querySelector("#fixedNumbersChips");
const fixedNumbersStatusEl = document.querySelector("#fixedNumbersStatus");
const clearFixedNumbersButton = document.querySelector("#clearFixedNumbersButton");
const waterTempEl = document.querySelector("#waterTemp");
const waterMetaEl = document.querySelector("#waterMeta");
const refreshWaterButton = document.querySelector("#refreshWaterButton");
const winningRoundEl = document.querySelector("#winningRound");
const winningNumbersEl = document.querySelector("#winningNumbers");
const winningBonusEl = document.querySelector("#winningBonus");
const winningDateEl = document.querySelector("#winningDate");
const winningStatusEl = document.querySelector("#winningStatus");
const refreshWinningButton = document.querySelector("#refreshWinningButton");
const guestbookForm = document.querySelector("#guestbookForm");
const guestNameEl = document.querySelector("#guestName");
const guestMessageEl = document.querySelector("#guestMessage");
const guestbookStatusEl = document.querySelector("#guestbookStatus");
const guestbookListEl = document.querySelector("#guestbookList");
const guestSubmitButton = document.querySelector("#guestSubmitButton");
const adminStatusEl = document.querySelector("#adminStatus");
const adminLoginButton = document.querySelector("#adminLoginButton");
const history = [];

function ballColor(number) {
  if (number <= 10) return "yellow";
  if (number <= 20) return "blue";
  if (number <= 30) return "red";
  if (number <= 40) return "gray";
  return "green";
}

function createBall(number) {
  const ball = document.createElement("span");
  ball.className = `ball ${ballColor(number)}`;
  ball.textContent = number;
  return ball;
}

function createFixedChip(number) {
  const chip = document.createElement("span");
  chip.className = "fixed-chip";
  chip.textContent = number;
  return chip;
}

function parseFixedNumbers() {
  const rawValue = fixedNumbersInput.value.trim();

  if (!rawValue) {
    return [];
  }

  const tokens = rawValue.split(/[\s,]+/).filter(Boolean);
  const numbers = tokens.map((token) => Number(token));

  if (numbers.some((number) => !Number.isInteger(number))) {
    throw new Error("숫자만 입력해 주세요.");
  }

  if (numbers.some((number) => number < 1 || number > 45)) {
    throw new Error("고정 번호는 1부터 45까지만 가능합니다.");
  }

  if (new Set(numbers).size !== numbers.length) {
    throw new Error("고정 번호가 중복되었습니다.");
  }

  if (numbers.length > 6) {
    throw new Error("고정 번호는 최대 6개까지 가능합니다.");
  }

  return numbers.sort((a, b) => a - b);
}

function updateFixedNumbersPreview() {
  try {
    const fixedNumbers = parseFixedNumbers();
    fixedNumbersChipsEl.replaceChildren(...fixedNumbers.map(createFixedChip));
    fixedNumbersStatusEl.textContent = fixedNumbers.length
      ? `${fixedNumbers.join(", ")}번을 고정하고 생성합니다.`
      : "고정 번호 없이 생성합니다.";
    return fixedNumbers;
  } catch (error) {
    fixedNumbersChipsEl.replaceChildren();
    fixedNumbersStatusEl.textContent = error.message;
    return null;
  }
}

function pickNumbers(fixedNumbers = []) {
  const pool = Array.from(
    { length: 45 },
    (_, index) => index + 1,
  ).filter((number) => !fixedNumbers.includes(number));

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
  }

  const randomCount = 6 - fixedNumbers.length;
  const picked = [...fixedNumbers, ...pool.slice(0, randomCount)].sort((a, b) => a - b);
  const bonus = pool[randomCount];
  return { picked, bonus, fixedNumbers };
}

function renderHistory() {
  historyEl.replaceChildren();

  history.slice(0, 5).forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const fixedText = entry.fixedNumbers.length
      ? ` · 고정 ${entry.fixedNumbers.join(", ")}`
      : "";
    item.textContent = `${entry.picked.join(", ")} + 보너스 ${entry.bonus}${fixedText}`;
    historyEl.append(item);
  });
}

function generate() {
  const fixedNumbers = updateFixedNumbersPreview();

  if (!fixedNumbers) {
    return;
  }

  const result = pickNumbers(fixedNumbers);
  numbersEl.replaceChildren(...result.picked.map(createBall));
  bonusEl.replaceChildren(createBall(result.bonus));

  history.unshift(result);
  renderHistory();
}

async function loadWaterTemperature() {
  waterMetaEl.textContent = "수온 정보를 불러오는 중입니다.";
  refreshWaterButton.disabled = true;

  try {
    const response = await fetch(waterApiUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Water temperature request failed");
    }

    const data = await response.json();

    if (!data.success || typeof data.temperature !== "number") {
      throw new Error("Water temperature response is invalid");
    }

    waterTempEl.textContent = `${data.temperature.toFixed(1)}℃`;
    waterMetaEl.textContent = `${data.date.slice(4, 6)}월 ${data.date.slice(6, 8)}일 ${data.time} · ${data.location} 측정`;
  } catch (error) {
    console.error(error);
    waterTempEl.textContent = "--.-℃";
    waterMetaEl.textContent = "한강 수온 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    refreshWaterButton.disabled = false;
  }
}

function renderWinningNumbers(result) {
  const drawDate = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(result.date));

  winningRoundEl.textContent = `${result.draw_no}회`;
  winningDateEl.textContent = `${drawDate} 추첨`;
  winningNumbersEl.replaceChildren(...result.numbers.map(createBall));
  winningBonusEl.replaceChildren(createBall(result.bonus_no));
  winningStatusEl.textContent = "최근 공개 데이터 기준 최신 당첨번호입니다.";
}

async function fetchLatestWinningRound() {
  const response = await fetch(latestLottoApiUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Lotto result request failed");
  }

  const data = await response.json();

  if (
    typeof data.draw_no !== "number"
    || !Array.isArray(data.numbers)
    || data.numbers.length !== 6
    || typeof data.bonus_no !== "number"
  ) {
    throw new Error("Lotto result response is invalid");
  }

  return data;
}

async function loadLatestWinningNumbers() {
  winningStatusEl.textContent = "최신 회차를 확인하는 중입니다.";
  winningRoundEl.textContent = "조회 중";
  winningNumbersEl.replaceChildren();
  winningBonusEl.replaceChildren();
  winningDateEl.textContent = "";
  refreshWinningButton.disabled = true;

  try {
    const result = await fetchLatestWinningRound();
    renderWinningNumbers(result);
  } catch (error) {
    console.error(error);
    winningRoundEl.textContent = "조회 실패";
    winningStatusEl.textContent = "최근 당첨번호를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    refreshWinningButton.disabled = false;
  }
}

function formatGuestbookDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function isAdmin() {
  return Boolean(currentUser?.email && adminEmail && currentUser.email === adminEmail);
}

function renderGuestbookEntry(id, entry) {
  const wrapper = document.createElement("article");
  wrapper.className = "guestbook-entry";

  const header = document.createElement("div");
  header.className = "guestbook-entry-header";

  const name = document.createElement("span");
  name.textContent = entry.name || "익명";

  const time = document.createElement("time");
  time.className = "guestbook-entry-time";
  time.textContent = formatGuestbookDate(entry.createdAt);

  const message = document.createElement("div");
  message.className = "guestbook-entry-message";
  message.textContent = entry.message || "";

  header.append(name, time);
  wrapper.append(header, message);

  if (isAdmin()) {
    const actions = document.createElement("div");
    actions.className = "guestbook-entry-actions";

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => deleteGuestbookEntry(id, deleteButton));

    actions.append(deleteButton);
    wrapper.append(actions);
  }

  return wrapper;
}

async function deleteGuestbookEntry(id, deleteButton) {
  const confirmed = window.confirm("이 방명록을 삭제할까요?");

  if (!confirmed || !db) {
    return;
  }

  deleteButton.disabled = true;
  guestbookStatusEl.textContent = "방명록을 삭제하는 중입니다.";

  try {
    await deleteDoc(doc(db, "guestbook", id));
    guestbookStatusEl.textContent = "방명록이 삭제되었습니다.";
  } catch (error) {
    console.error(error);
    guestbookStatusEl.textContent = "삭제에 실패했습니다. 관리자 로그인 상태를 확인해 주세요.";
    deleteButton.disabled = false;
  }
}

function subscribeGuestbook() {
  if (!guestbookCollection) {
    guestbookStatusEl.textContent = ".env 설정이 없어 방명록을 불러올 수 없습니다.";
    adminStatusEl.textContent = ".env 설정이 필요합니다.";
    adminLoginButton.disabled = true;
    return;
  }

  if (unsubscribeGuestbook) {
    unsubscribeGuestbook();
  }

  const guestbookQuery = query(
    guestbookCollection,
    orderBy("createdAt", "desc"),
    limit(30),
  );

  unsubscribeGuestbook = onSnapshot(
    guestbookQuery,
    (snapshot) => {
      guestbookListEl.replaceChildren(
        ...snapshot.docs.map((entryDoc) => renderGuestbookEntry(entryDoc.id, entryDoc.data())),
      );

      guestbookStatusEl.textContent = snapshot.empty
        ? "아직 남겨진 방명록이 없습니다."
        : `방명록 ${snapshot.size}개를 불러왔습니다.`;
    },
    (error) => {
      console.error(error);
      guestbookStatusEl.textContent = "방명록을 불러오지 못했습니다. Firestore 규칙을 확인해 주세요.";
    },
  );
}

async function submitGuestbook(event) {
  event.preventDefault();

  if (!guestbookCollection) {
    guestbookStatusEl.textContent = ".env 설정이 없어 방명록을 저장할 수 없습니다.";
    return;
  }

  const name = guestNameEl.value.trim();
  const message = guestMessageEl.value.trim();

  if (!name || !message) {
    guestbookStatusEl.textContent = "이름과 메시지를 모두 입력해 주세요.";
    return;
  }

  guestSubmitButton.disabled = true;
  guestbookStatusEl.textContent = "방명록을 저장하는 중입니다.";

  try {
    await addDoc(guestbookCollection, {
      name,
      message,
      createdAt: serverTimestamp(),
    });

    guestbookForm.reset();
    guestbookStatusEl.textContent = "방명록이 등록되었습니다.";
  } catch (error) {
    console.error(error);
    guestbookStatusEl.textContent = "방명록 저장에 실패했습니다. Firestore 규칙을 확인해 주세요.";
  } finally {
    guestSubmitButton.disabled = false;
  }
}

async function toggleAdminLogin() {
  if (!auth) {
    adminStatusEl.textContent = ".env 설정이 없어 Google 로그인을 사용할 수 없습니다.";
    return;
  }

  adminLoginButton.disabled = true;

  try {
    if (currentUser) {
      await signOut(auth);
    } else {
      await signInWithPopup(auth, googleProvider);
    }
  } catch (error) {
    console.error(error);
    adminStatusEl.textContent = "Google 로그인에 실패했습니다.";
  } finally {
    adminLoginButton.disabled = false;
  }
}

function updateAdminState(user) {
  currentUser = user;

  if (!user) {
    adminStatusEl.textContent = "관리자 로그인이 필요합니다.";
    adminLoginButton.textContent = "Google 관리자 로그인";
    return;
  }

  adminStatusEl.textContent = isAdmin()
    ? `${user.email} 관리자 로그인 중`
    : `${user.email} 로그인됨 - 관리자 권한 없음`;

  adminLoginButton.textContent = "로그아웃";
}

button.addEventListener("click", generate);
fixedNumbersInput.addEventListener("input", updateFixedNumbersPreview);
clearFixedNumbersButton.addEventListener("click", () => {
  fixedNumbersInput.value = "";
  updateFixedNumbersPreview();
  generate();
});
refreshWaterButton.addEventListener("click", loadWaterTemperature);
refreshWinningButton.addEventListener("click", loadLatestWinningNumbers);
guestbookForm.addEventListener("submit", submitGuestbook);
adminLoginButton.addEventListener("click", toggleAdminLogin);

if (auth) {
  onAuthStateChanged(auth, (user) => {
    updateAdminState(user);
    subscribeGuestbook();
  });
} else {
  subscribeGuestbook();
}

generate();
loadLatestWinningNumbers();
loadWaterTemperature();
