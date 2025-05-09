// script.js (로직 파일)

// --- 전역 변수 ---
let weekdayScheduleBtn, weekendScheduleBtn, wangpyeonBtn, bokpyeonBtn;
let showTimetableBtn;
let statusDiv, infoMessageDiv;
let currentScheduleType = "weekday";
let currentRoute = "wang";
let updateTimer = null;

// --- 유틸리티 함수 ---
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":"))
    return -1;
  const parts = timeStr.split(":");
  if (parts.length !== 2) return -1;
  const [hours, minutes] = parts.map(Number);
  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  )
    return -1;
  return hours * 60 + minutes;
}

function findNextBus(data, stopColumnKey1, stopColumnKey2 = null) {
  if (!data || data.length === 0) return null;
  const now = new Date();
  const currentSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let nextBus = null,
    minSecondsUntil = Infinity;

  for (const row of data) {
    let busTimeStr = row[stopColumnKey1],
      busMinutes = timeToMinutes(busTimeStr),
      usedStopKey = stopColumnKey1;
    if (busMinutes === -1 && stopColumnKey2) {
      busTimeStr = row[stopColumnKey2];
      busMinutes = timeToMinutes(busTimeStr);
      usedStopKey = stopColumnKey2;
    }
    if (busMinutes === -1) continue;

    const busSeconds = busMinutes * 60;
    const secondsUntil = busSeconds - currentSeconds;

    if (secondsUntil >= 0 && secondsUntil < minSecondsUntil) {
      minSecondsUntil = secondsUntil;
      nextBus = {
        time: busTimeStr,
        minutesUntil: secondsUntil / 60,
        rowData: row,
        stopUsed: usedStopKey,
      };
      if (secondsUntil < 60) break;
    }
  }
  return nextBus;
}

function findTableRowByRowData(rowData) {
  if (!rowData || typeof rowData.연번 === "undefined") return null;
  const tableSelector = `#${currentScheduleType}-${currentRoute}-timetable .${currentRoute}-table`;
  const tbody = document.querySelector(`${tableSelector} tbody`);
  if (!tbody) return null;

  const rows = tbody.querySelectorAll("tr");
  for (const row of rows) {
    if (row.classList.contains("empty-message-row")) continue;
    const 연번Cell = row.querySelector('td[data-label="연번"]') || row.cells[0];
    if (연번Cell && 연번Cell.textContent) {
      if (parseInt(연번Cell.textContent, 10) === rowData.연번) return row;
    }
  }
  return null;
}

// --- UI 업데이트 함수 ---
function updateStatus() {
  const now = new Date();
  const currentTime = `${now.getHours()}:${String(now.getMinutes()).padStart(
    2,
    "0"
  )}`;
  let dataToUse,
    primaryStopKey,
    secondaryStopKey,
    friendlyStartStopName,
    actualStopUsedForDisplay;

  if (currentScheduleType === "weekday") {
    dataToUse =
      currentRoute === "wang" ? weekdayWangpyeonData : weekdayBokpyeonData;
  } else {
    dataToUse =
      currentRoute === "wang" ? weekendWangpyeonData : weekendBokpyeonData;
  }

  if (currentRoute === "wang") {
    primaryStopKey = "밀양역";
    secondaryStopKey = "영남루";
    friendlyStartStopName = "밀양역";
  } else {
    primaryStopKey = "부산대";
    secondaryStopKey = null;
    friendlyStartStopName = "부산대";
  }

  const nextBusInfo = findNextBus(dataToUse, primaryStopKey, secondaryStopKey);

  document
    .querySelectorAll(".timetable-container.active .next-bus")
    .forEach((row) => row.classList.remove("next-bus"));

  let statusContent = "";
  if (nextBusInfo && nextBusInfo.time) {
    const minutesUntil = nextBusInfo.minutesUntil;
    const displayMinutesUntil = Math.max(0, Math.floor(minutesUntil));
    let timeIndicatorClass =
      minutesUntil < 6 ? "soon" : minutesUntil < 16 ? "upcoming" : "later";
    const arrivalStatusText =
      minutesUntil < 1 ? "곧 출발" : `${displayMinutesUntil}분 후 출발`;
    actualStopUsedForDisplay =
      nextBusInfo.stopUsed === "밀양역발" ? "밀양역" : nextBusInfo.stopUsed;

    statusContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>현재 시각: ${currentTime} | <span style="font-weight: bold;">${actualStopUsedForDisplay}</span> 기준 다음 버스: ${nextBusInfo.time}</span>
        <span class="time-indicator ${timeIndicatorClass}">${arrivalStatusText}</span>`;

    const nextBusTableRow = findTableRowByRowData(nextBusInfo.rowData);
    if (nextBusTableRow) {
      nextBusTableRow.classList.add("next-bus");
      if (window.innerWidth <= 768 && nextBusTableRow.offsetParent !== null) {
        setTimeout(() => {
          try {
            nextBusTableRow.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } catch (e) {}
        }, 150);
      }
    }
  } else {
    statusContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>현재 시각: ${currentTime} | <span style="font-weight: bold;">${friendlyStartStopName}</span> 기준 오늘은 더 이상 버스 운행이 없습니다.</span>`;
  }
  if (statusDiv) statusDiv.innerHTML = statusContent;
}

function updateInfoMessage() {
  if (!infoMessageDiv) return;
  const now = new Date();
  const today = now.getDay();
  let dayTypeStatusText = "",
    iconSvgPath = "",
    infoClass = "";

  if (today >= 1 && today <= 5) {
    dayTypeStatusText = "오늘은 평일입니다.";
    iconSvgPath =
      '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>';
  } else {
    dayTypeStatusText = "오늘은 주말입니다.";
    iconSvgPath =
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>';
    infoClass = "warning";
  }
  const currentViewText =
    currentScheduleType === "weekday"
      ? "현재 평일 시간표를"
      : "현재 주말·공휴일 시간표를";

  infoMessageDiv.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconSvgPath}</svg>
    <span>${dayTypeStatusText} ${currentViewText} 보고 있습니다.</span>`;

  infoMessageDiv.classList.toggle(
    "warning",
    (today === 0 || today === 6) && currentScheduleType === "weekend"
  );
}

function populateTable(data, tableSelector, columns) {
  const tbody = document.querySelector(`${tableSelector} tbody`);
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    const row = tbody.insertRow();
    row.classList.add("empty-message-row");
    const cell = row.insertCell();
    cell.colSpan = columns.length;
    cell.textContent = "시간표 정보가 없습니다.";
    Object.assign(cell.style, {
      textAlign: "center",
      padding: "20px",
      fontStyle: "italic",
      color: "var(--dark-gray)",
    });
    return;
  }
  data.forEach((rowData) => {
    const row = tbody.insertRow();
    columns.forEach((colKey) => {
      const cell = row.insertCell();
      const displayColKey = colKey === "밀양역발" ? "밀양역" : colKey;
      cell.setAttribute("data-label", displayColKey);
      cell.textContent = rowData[colKey] || "";
    });
  });
}

function updateTimetableContainersDisplay() {
  document.querySelectorAll(".timetable-container").forEach((c) => {
    c.classList.remove("active");
    c.style.display = "none";
  });
  const activeContainerId = `${currentScheduleType}-${currentRoute}-timetable`;
  const activeContainer = document.getElementById(activeContainerId);
  if (activeContainer) {
    activeContainer.style.display = "block";
    requestAnimationFrame(() => activeContainer.classList.add("active"));
  }
}

function updateScheduleDisplay() {
  if (weekdayScheduleBtn) {
    // Ensure buttons are loaded
    weekdayScheduleBtn.classList.toggle(
      "active",
      currentScheduleType === "weekday"
    );
    weekendScheduleBtn.classList.toggle(
      "active",
      currentScheduleType === "weekend"
    );
    wangpyeonBtn.classList.toggle("active", currentRoute === "wang");
    bokpyeonBtn.classList.toggle("active", currentRoute === "bok");
  }

  let dataToUse, tableSelector, columns;
  // Ensure timetableData variables are available (loaded from timetable_data.js)
  if (typeof weekdayWangpyeonData === "undefined") {
    // console.error("Timetable data not loaded yet.");
    if (infoMessageDiv)
      infoMessageDiv.innerHTML =
        "시간표 데이터를 불러오지 못했습니다. timetable_data.js 파일이 올바른지 확인해주세요.";
    return;
  }

  if (currentScheduleType === "weekday")
    dataToUse =
      currentRoute === "wang" ? weekdayWangpyeonData : weekdayBokpyeonData;
  else
    dataToUse =
      currentRoute === "wang" ? weekendWangpyeonData : weekendBokpyeonData;

  if (currentRoute === "wang") {
    tableSelector = `#${currentScheduleType}-wangpyeon-timetable .wangpyeon-table`;
    columns = ["연번", "영남루", "밀양역", "부산대"];
  } else {
    tableSelector = `#${currentScheduleType}-bokpyeon-timetable .bokpyeon-table`;
    columns = ["연번", "부산대", "밀양역발", "영남루"];
  }

  updateInfoMessage();
  updateTimetableContainersDisplay();
  populateTable(dataToUse, tableSelector, columns);
  updateStatus();
}

function checkInitialDayTypeAndSetup() {
  const today = new Date().getDay();
  currentScheduleType = today >= 1 && today <= 5 ? "weekday" : "weekend";

  // HTML에서 버튼의 초기 .active 클래스 상태를 읽어 currentRoute 설정
  // 버튼이 존재하고 .active 클래스가 있는지 확인
  if (wangpyeonBtn && wangpyeonBtn.classList.contains("active")) {
    currentRoute = "wang";
  } else if (bokpyeonBtn && bokpyeonBtn.classList.contains("active")) {
    currentRoute = "bok";
  } else {
    // 둘 다 active가 아니거나 버튼을 찾을 수 없으면 JS에서 기본값 설정
    currentRoute = "wang"; // 기본값을 왕편으로
    if (wangpyeonBtn) wangpyeonBtn.classList.add("active");
    if (bokpyeonBtn) bokpyeonBtn.classList.remove("active");
  }

  if (updateTimer) clearInterval(updateTimer);
  updateTimer = setInterval(updateStatus, 30000);

  updateScheduleDisplay();
}

function sortTimeData(data, sortKey1, sortKey2 = null) {
  if (!data || data.length === 0) return;
  data.sort((a, b) => {
    let aVal = timeToMinutes(a[sortKey1]),
      bVal = timeToMinutes(b[sortKey1]);
    if (aVal === -1 && sortKey2) aVal = timeToMinutes(a[sortKey2]);
    if (bVal === -1 && sortKey2) bVal = timeToMinutes(b[sortKey2]);
    return (aVal === -1 ? Infinity : aVal) - (bVal === -1 ? Infinity : bVal);
  });
  data.forEach((item, index) => (item.연번 = index + 1));
}

// 필수 DOM 요소들을 가져옵니다.
function getDOMElements() {
  weekdayScheduleBtn = document.getElementById("weekday-schedule-btn");
  weekendScheduleBtn = document.getElementById("weekend-schedule-btn");
  wangpyeonBtn = document.getElementById("wangpyeon-btn");
  bokpyeonBtn = document.getElementById("bokpyeon-btn");
  showTimetableBtn = document.getElementById("show-timetable-btn");
  statusDiv = document.getElementById("status");
  infoMessageDiv = document.getElementById("info-message");

  // 하나라도 없으면 false 반환 (이로 인해 initializePage가 중단될 수 있음)
  return !!(
    weekdayScheduleBtn &&
    weekendScheduleBtn &&
    wangpyeonBtn &&
    bokpyeonBtn &&
    showTimetableBtn &&
    statusDiv &&
    infoMessageDiv
  );
}

// 버튼들에 이벤트 리스너를 설정합니다.
function setupEventListeners() {
  // getDOMElements에서 이미 요소를 찾았다고 가정. (null 체크는 initializePage에서 수행)
  weekdayScheduleBtn.addEventListener("click", () => {
    if (currentScheduleType !== "weekday") {
      currentScheduleType = "weekday";
      updateScheduleDisplay();
    }
  });
  weekendScheduleBtn.addEventListener("click", () => {
    if (currentScheduleType !== "weekend") {
      currentScheduleType = "weekend";
      updateScheduleDisplay();
    }
  });
  wangpyeonBtn.addEventListener("click", () => {
    if (currentRoute !== "wang") {
      currentRoute = "wang";
      updateScheduleDisplay();
    }
  });
  bokpyeonBtn.addEventListener("click", () => {
    if (currentRoute !== "bok") {
      currentRoute = "bok";
      updateScheduleDisplay();
    }
  });

  showTimetableBtn.addEventListener("click", () => {
    // 1. 현재 선택된 시간표 컨테이너를 화면에 표시합니다.
    // updateTimetableContainersDisplay 함수는 해당 컨테이너의 display를 'block'으로 만들고
    // 'active' 클래스를 추가하여 CSS 애니메이션(fadeIn)이 적용되도록 합니다.
    updateTimetableContainersDisplay();

    // 2. 표시된 시간표로 스크롤합니다.
    // DOM 업데이트(display:block 설정)와 CSS 애니메이션 시작을 고려하여
    // requestAnimationFrame 내에서 스크롤을 실행하는 것이 더 안정적입니다.
    requestAnimationFrame(() => {
      const activeTimetableId = `${currentScheduleType}-${currentRoute}-timetable`;
      const activeTimetableElement = document.getElementById(activeTimetableId);
      // 요소가 존재하고 실제로 화면에 보이는 상태인지 한 번 더 확인
      if (
        activeTimetableElement &&
        activeTimetableElement.style.display === "block"
      ) {
        activeTimetableElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", checkDarkMode);
}

function checkDarkMode() {
  document.body.classList.toggle(
    "dark-mode",
    window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

// 페이지 전체 초기화 함수
function initializePage() {
  if (!getDOMElements()) {
    // getDOMElements에서 모든 필수 요소를 찾았는지 확인
    const initialInfoMsgDiv = document.getElementById("info-message"); // 다시 한번 시도
    if (initialInfoMsgDiv) {
      // infoMessageDiv가 null이 아닐때만 내부 HTML 수정 시도
      initialInfoMsgDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span>웹 페이지 구성에 필요한 요소를 찾을 수 없습니다. HTML의 ID를 확인해주세요.</span>`;
      initialInfoMsgDiv.classList.add("warning");
      initialInfoMsgDiv.style.display = "flex"; // 보이도록 강제
    } else {
      console.error(
        "심각한 오류: info-message div 조차 찾을 수 없어 사용자에게 오류를 알릴 수 없습니다."
      );
    }
    // 필수 요소가 없으므로, 이후 로직(시간표 표시 등) 실행 안함
    return;
  }

  infoMessageDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>시간표 데이터를 준비하고 있습니다...</span>`;

  // timetable_data.js에 정의된 변수들이 전역적으로 사용 가능해야 함
  sortTimeData(weekdayWangpyeonData, "영남루", "밀양역");
  sortTimeData(weekdayBokpyeonData, "부산대");
  sortTimeData(weekendWangpyeonData, "영남루", "밀양역");
  sortTimeData(weekendBokpyeonData, "부산대");

  setupEventListeners();
  checkInitialDayTypeAndSetup();
  checkDarkMode();
}

document.addEventListener("DOMContentLoaded", initializePage);
