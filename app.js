const STORAGE_KEY = "usbanglaRosterState.v1";
const STAFF_KEY = "usbanglaRosterStaff.v1";

const sectionSchema = [
  {
    key: "domestic",
    title: "DOMESTIC",
    fields: [
      ["domestic.frontGateVip", "FRONT GATE (VIP)"],
      ["domestic.frontGateGen", "FRONT GATE (GENERAL)"],
      ["domestic.checking", "CHECKING COUNTER"],
      ["domestic.wheelChairDept", "WHEEL CHAIR (DEPT)"],
      ["domestic.wheelChairArv", "WHEEL CHAIR (ARV)"],
      ["domestic.makeup", "BAGGAGE MAKE UP AREA"],
      ["domestic.ramp", "RAMP AREA"],
      ["domestic.arrivalBelt", "ARRIVAL BELT"]
    ]
  },
  {
    key: "international",
    title: "INTERNATIONAL",
    fields: [
      ["international.checking", "CHECKING COUNTER"],
      ["international.makeup", "BAGGAGE MAKEUP AREA"],
      ["international.ramp", "RAMP AREA"],
      ["international.arrivalBelt", "ARRIVAL BAGGAGE BELT"],
      ["international.arrivalHall", "ARRIVAL BAGGAGE HALL"],
      ["international.wheelChairInt", "WHEELCHAIR (INT)"],
      ["international.nightStaff", "NIGHT STAFF"]
    ]
  },
  {
    key: "off",
    title: "OFF DUTY",
    fields: [
      ["off.normal", "DAY OFF"],
      ["off.casualEarnedGovt", "CASUAL/EARNED/GOVT"],
      ["off.sick", "SICK LEAVE"],
      ["off.compensatory", "COMPENSATORY OFF"],
      ["off.absent", "ABSENT (PREVIOUS DAY)"]
    ]
  }
];

// ফিমেল হুইলচেয়ার স্পেশাল স্টাফ আইডি লিস্ট
const WHEELCHAIR_ONLY_IDS = [
  "USBA-26833", "USBA-26834", "USBA-27790", "USBA-27792",
  "USBA-28094", "USBA-28097", "USBA-28099", "USBA-28101",
  "USBA-28103", "USBA-27788", "USBA-27789", "USBA-28095",
  "USBA-28096", "USBA-28098", "USBA-28100", "USBA-28102"
];

const state = {
  creator: "",
  date: "",
  shift: "MORNING",
  instruction: "",
  selections: {},
  customFields: [],
  emStaff: []
};

let staff = [];
let activeDropdown = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", async () => {
  initTypewriter();
  await loadStaff();
  restoreState();
  buildSections();
  bindEvents();
  updateClock();
  setInterval(updateClock, 1000);
  renderAppMode();
  updateAllCounts();
  registerOfflineCache();
  setTimeout(() => $("#loader").classList.add("done"), 650);
});

async function loadStaff() {
  const savedStaff = localStorage.getItem(STAFF_KEY);
  if (savedStaff) {
    staff = normalizeStaff(JSON.parse(savedStaff));
    return;
  }

  const embedded = document.getElementById("staffData")?.textContent.trim();
  if (embedded && embedded !== "__STAFF_DATA__") {
    staff = normalizeStaff(JSON.parse(embedded).staff || []);
  } else {
    const response = await fetch("data.json", { cache: "no-store" });
    const data = await response.json();
    staff = normalizeStaff(data.staff || []);
  }
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

function normalizeStaff(list) {
  const map = new Map();
  list.forEach((person) => {
    const id = String(person.id || person["STAFF ID"] || person.ID || "").trim();
    const name = String(person.name || person["STAFF NAME"] || person.NAME || "").trim();
    if (!id || !name) return;
    const number = Number(String(person.number || id).replace(/\D/g, "")) || 0;
    map.set(id, { id, name, number });
  });
  return Array.from(map.values()).sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
}

function restoreState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
    if (!state.customFields) state.customFields = [];
    if (!state.emStaff) state.emStaff = [];
  }
  if (!state.date) state.date = new Date().toISOString().slice(0, 10);
  
  getCombinedSchema().flatMap((section) => section.fields).forEach(([key]) => {
    if (!Array.isArray(state.selections[key])) state.selections[key] = [];
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCombinedSchema() {
  return sectionSchema.map(section => {
    const custom = (state.customFields || []).filter(cf => cf.sectionKey === section.key);
    return {
      ...section,
      fields: [
        ...section.fields,
        ...custom.map(cf => [cf.fieldKey, cf.label])
      ]
    };
  });
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const creator = $("#creatorName").value.trim();
    if (!creator) return toast("Please enter creator name.");
    state.creator = creator;
    saveState();
    renderAppMode();
    toast(`Welcome, ${creator}`);
  });

  $("#logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STAFF_KEY);
    location.reload();
  });

  $("#rosterDate").addEventListener("change", (event) => {
    state.date = event.target.value;
    saveState();
  });

  // শিফট পরিবর্তন করার সময় সাথে সাথে ভিউ বিল্ড করার লজিক
  $("#shiftSelect").addEventListener("change", (event) => {
    state.shift = event.target.value;
    saveState();
    buildSections(); 
    updateAllCounts();
  });

  $("#specialInstruction").addEventListener("input", (event) => {
    state.instruction = event.target.value;
    saveState();
  });

  $("#excelImport").addEventListener("change", importExcel);
  $("#generateReportBtn").addEventListener("click", generateReport);

  $("#addCustomFieldBtn").addEventListener("click", () => {
    const section = $("#customFieldSection").value;
    const label = $("#customFieldLabel").value.trim();
    if (!label) return toast("Please enter a field name.");

    const fieldKey = `${section}.custom_${Date.now()}`;
    state.customFields.push({ sectionKey: section, fieldKey, label });
    state.selections[fieldKey] = [];
    saveState();

    $("#customFieldLabel").value = "";
    buildSections();
    updateAllCounts();
    toast(`Added "${label}" to ${section.toUpperCase()} column.`);
  });

  document.addEventListener("click", (event) => {
    if (activeDropdown && !event.target.closest(".dropdown-panel") && !event.target.closest(".multi-trigger")) {
      closeDropdown();
    }
  });
}

function renderAppMode() {
  const loggedIn = Boolean(state.creator);
  $("#loginPage").classList.toggle("hidden", loggedIn);
  $("#dashboardPage").classList.toggle("hidden", !loggedIn);
  $("#creatorName").value = state.creator || "";
  $("#creatorBadge").textContent = state.creator || "";
  $("#welcomeName").textContent = `WELCOME, ${state.creator || "CREATOR"}`;
  $("#rosterDate").value = state.date;
  $("#shiftSelect").value = state.shift;
  $("#specialInstruction").value = state.instruction || "";
  $("#staffTotal").textContent = staff.length;
}

function buildSections() {
  const schema = getCombinedSchema();
  $("#sectionsGrid").innerHTML = schema.map((section) => `
    <article class="roster-column glass-panel ${section.key}" data-section="${section.key}">
      <div class="section-head">
        <h3>${section.title}</h3>
        <strong id="${section.key}Count">0</strong>
      </div>
      <div class="field-stack">
        ${section.fields.map(([key, label]) => createFieldMarkup(key, label)).join("")}
      </div>
    </article>
  `).join("");

  $$(".multi-trigger").forEach((button) => {
    button.addEventListener("click", () => openDropdown(button.dataset.field));
  });

  $$(".delete-field-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const fieldKey = btn.dataset.deleteField;
      if (confirm("Are you sure you want to delete this custom field?")) {
        state.customFields = state.customFields.filter(cf => cf.fieldKey !== fieldKey);
        delete state.selections[fieldKey];
        saveState();
        buildSections();
        updateAllCounts();
        toast("Field deleted successfully.");
      }
    });
  });

  renderSelectedLists();
}

function createFieldMarkup(key, label) {
  const isCustom = key.includes(".custom_");
  const deleteBtn = isCustom ? `<button class="delete-field-btn" type="button" data-delete-field="${key}" title="Delete this field">×</button>` : "";
  
  return `
    <div class="multi-field ${isCustom ? 'custom-field-box' : ''}" data-field="${key}">
      <div class="field-header" style="display: flex; align-items: center; justify-content: space-between;">
        <button class="multi-trigger" type="button" data-field="${key}" style="flex: 1; text-align: left;">
          <span>${label}</span>
          <small id="${cssId(key)}Count">0 selected</small>
        </button>
        ${deleteBtn}
      </div>
      <div class="selected-list" id="${cssId(key)}List"></div>
    </div>
  `;
}

function renderSelectedLists() {
  getCombinedSchema().flatMap((section) => section.fields).forEach(([key]) => {
    const selected = getSelectedStaff(key);
    const list = $(`#${cssId(key)}List`);
    const count = $(`#${cssId(key)}Count`);
    if (!list || !count) return;
    count.textContent = `${selected.length} selected`;
    
    list.innerHTML = selected.map((person, index) => {
      const isEM = (state.emStaff || []).includes(person.id);
      
      // MORNING শিফটে থাকলেই কেবল ডমেস্টিক এবং ইন্টারন্যাশনাল কলামের জন্য E/M চেকবক্স দেখানোর লজিক
      const isMorning = state.shift === "MORNING";
      const showEM = isMorning && (key.startsWith("domestic") || key.startsWith("international"));
      
      const emToggle = showEM ? `
        <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #cf1f32; font-weight: 800; cursor: pointer; margin-right: 6px; user-select: none;">
          <input type="checkbox" class="em-staff-checkbox" data-staff-id="${person.id}" ${isEM ? "checked" : ""} style="width: 14px; height: 14px; margin: 0; cursor: pointer;"> E/M
        </label>
      ` : "";

      return `
        <div class="selected-chip" style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 600;">${index + 1}. ${person.id} - ${person.name}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${emToggle}
            <button type="button" aria-label="Remove ${person.name}" data-remove="${person.id}" data-field="${key}" style="margin:0;">x</button>
          </div>
        </div>
      `;
    }).join("");
  });

  $$("[data-remove]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeStaff(button.dataset.field, button.dataset.remove);
    });
  });

  $$(".em-staff-checkbox").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.staffId;
      if (!state.emStaff) state.emStaff = [];
      if (cb.checked) {
        if (!state.emStaff.includes(id)) state.emStaff.push(id);
      } else {
        state.emStaff = state.emStaff.filter(item => item !== id);
      }
      saveState();
    });
  });
}

function getSelectedStaff(fieldKey) {
  const selectedIds = new Set(state.selections[fieldKey] || []);
  return staff.filter((person) => selectedIds.has(person.id));
}

function getAssignedMap(exceptField = "") {
  const assigned = new Map();
  Object.entries(state.selections).forEach(([field, ids]) => {
    if (field === exceptField) return;
    ids.forEach((id) => assigned.set(id, field));
  });
  return assigned;
}

function openDropdown(fieldKey) {
  closeDropdown();
  const trigger = document.querySelector(`[data-field="${fieldKey}"].multi-trigger`);
  const rect = trigger.getBoundingClientRect();
  const panel = document.createElement("div");
  panel.className = "dropdown-panel";
  panel.innerHTML = `
    <input type="search" placeholder="Search by staff ID or name">
    <div class="option-list"></div>
    <button type="button" class="soft-btn">Done</button>
  `;
  document.body.appendChild(panel);
  const left = Math.min(rect.left, window.innerWidth - panel.offsetWidth - 12);
  const top = Math.min(rect.bottom + 8, window.innerHeight - panel.offsetHeight - 12);
  panel.style.left = `${Math.max(12, left)}px`;
  panel.style.top = `${Math.max(12, top)}px`;
  activeDropdown = { fieldKey, panel };

  const input = panel.querySelector("input");
  const done = panel.querySelector("button");
  input.addEventListener("input", () => renderOptions(fieldKey, input.value));
  done.addEventListener("click", closeDropdown);
  renderOptions(fieldKey, "");
  input.focus();
}

function renderOptions(fieldKey, query) {
  const panel = activeDropdown?.panel;
  if (!panel) return;
  const list = panel.querySelector(".option-list");
  const selectedIds = new Set(state.selections[fieldKey] || []);
  const assigned = getAssignedMap(fieldKey);
  const term = query.trim().toLowerCase();
  
  const isWheelchairField = fieldKey.toLowerCase().includes("wheelchair");
  const isOffDutyField = fieldKey.startsWith("off.");

  const visible = staff.filter((person) => {
    if (assigned.has(person.id)) return false;

    const isWheelchairStaff = WHEELCHAIR_ONLY_IDS.includes(person.id);
    
    if (isOffDutyField) {
    } else if (isWheelchairField) {
      if (!isWheelchairStaff) return false;
    } else {
      if (isWheelchairStaff) return false;
    }

    if (!term) return true;
    return person.id.toLowerCase().includes(term) || person.name.toLowerCase().includes(term);
  }).slice(0, 500);

  list.innerHTML = visible.length ? visible.map((person) => `
    <label class="option-row">
      <input type="checkbox" data-option="${person.id}" ${selectedIds.has(person.id) ? "checked" : ""}>
      <span><strong>${highlight(person.id, term)}</strong>${highlight(person.name, term)}</span>
    </label>
  `).join("") : `<div class="empty-note">No available staff found.</div>`;

  list.querySelectorAll("[data-option]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      toggleStaff(fieldKey, checkbox.dataset.option, checkbox.checked);
      renderOptions(fieldKey, query);
    });
  });
}

function toggleStaff(fieldKey, staffId, checked) {
  const current = new Set(state.selections[fieldKey] || []);
  checked ? current.add(staffId) : current.delete(staffId);
  state.selections[fieldKey] = Array.from(current).sort(sortIds);
  saveState();
  renderSelectedLists();
  updateAllCounts();
}

function removeStaff(fieldKey, staffId) {
  toggleStaff(fieldKey, staffId, false);
  toast("Staff returned to available lists.");
}

function closeDropdown() {
  if (activeDropdown?.panel) activeDropdown.panel.remove();
  activeDropdown = null;
}

function updateAllCounts() {
  getCombinedSchema().forEach((section) => {
    const total = section.fields.reduce((sum, [key]) => sum + (state.selections[key] || []).length, 0);
    const node = $(`#${section.key}Count`);
    if (node) node.textContent = total;
  });
  const assignedTotal = Object.values(state.selections).reduce((sum, ids) => sum + ids.length, 0);
  $("#assignedSummary").textContent = `${assignedTotal} assigned`;
}

async function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!window.XLSX) return toast("XLSX library is still loading. Please try again.");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  const imported = [];
  rows.forEach((row) => {
    [[1, 2], [5, 6], [0, 1]].forEach(([idIndex, nameIndex]) => {
      const id = String(row[idIndex] || "").trim();
      const name = String(row[nameIndex] || "").trim();
      if (/USBA/i.test(id) && name && !/^name$/i.test(name)) imported.push({ id, name });
    });
  });
  staff = normalizeStaff(imported);
  if (!staff.length) return toast("No staff ID and name columns were found.");
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  $("#importLabel").textContent = `${staff.length} staff imported`;
  $("#staffTotal").textContent = staff.length;
  toast("Staff list imported and saved.");
  renderSelectedLists();
  updateAllCounts();
}

function generateReport() {
  if (!state.date) return toast("Please select roster date.");
  if (!state.creator) return toast("Please login with creator name.");
  const assignedTotal = Object.values(state.selections).reduce((sum, ids) => sum + ids.length, 0);
  if (!assignedTotal) return toast("Please select at least one staff member.");
  const reportState = { ...state, staff, schema: getCombinedSchema() };
  localStorage.setItem("usbanglaRosterReport.v1", JSON.stringify(reportState));
  buildRosterReportWindow(reportState);
}

function sortIds(a, b) {
  const left = Number(String(a).replace(/\D/g, "")) || 0;
  const right = Number(String(b).replace(/\D/g, "")) || 0;
  return left - right || a.localeCompare(b);
}

function cssId(value) {
  return value.replace(/[^a-z0-9]/gi, "_");
}

function highlight(text, term) {
  const safe = String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  if (!term) return safe;
  const index = safe.toLowerCase().indexOf(term);
  if (index < 0) return safe;
  return `${safe.slice(0, index)}<mark>${safe.slice(index, index + term.length)}</mark>${safe.slice(index + term.length)}`;
}

function updateClock() {
  $("#liveClock").textContent = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date());
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  $("#toastHost").appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function initTypewriter() {
  const target = $(".typewriter");
  const text = "Welcome To Radoan's App";
  let index = 0;
  const tick = () => {
    target.textContent = text.slice(0, index);
    index = index >= text.length ? 0 : index + 1;
    setTimeout(tick, index === 0 ? 1100 : 85);
  };
  tick();
}

function registerOfflineCache() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
