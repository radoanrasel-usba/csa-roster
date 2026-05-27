function buildRosterReportWindow(reportState) {
  const target = window.open("", "_blank");
  if (!target) {
    alert("Please allow popups to open the final report.");
    return;
  }
  target.document.open();
  target.document.write(getReportHtml(reportState));
  target.document.close();
}

function getReportHtml(reportState) {
  const { date, shift, creator, instruction, staff, schema, selections } = reportState;
  const staffMap = new Map(staff.map((person) => [person.id, person]));
  
  const sectionCounts = Object.fromEntries(schema.map((section) => [
    section.key,
    section.fields.reduce((sum, [key]) => sum + (selections[key] || []).length, 0)
  ]));
  const total = Object.values(sectionCounts).reduce((sum, value) => sum + value, 0);
  
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).toUpperCase();

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Roster ${date} ${shift}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <style>
      :root { --navy:#06285f; --blue:#0c63c7; --green:#177b38; --gold:#c69200; --red:#d7192f; --line:#d7e1ec; --ink:#111827; }
      * { box-sizing: border-box; }
      
      body { margin:0; background:#dcecff; font-family:Inter,Arial,sans-serif; color:var(--ink); }
      .toolbar { position:sticky; top:0; z-index:3; display:flex; justify-content:center; gap:10px; padding:10px; background:#061f4c; }
      .toolbar button { border:0; border-radius:10px; padding:10px 15px; color:white; font-weight:800; background:linear-gradient(135deg,#0b63ce,#07306c); cursor:pointer; }
      #report { width:1120px; min-height:1400px; margin:15px auto; padding:24px 30px 0; background:white; border:5px solid var(--navy); box-shadow:0 20px 50px rgba(5,31,72,.2); overflow:hidden; }
      
      .report-head { display:flex; justify-content:space-between; align-items:center; }
      .brand { display:flex; gap:12px; align-items:center; }
      .brand strong { display:block; color:#e2192a; font-size:32px; line-height:.9; font-weight:900; }
      .brand span { letter-spacing:.44em; color:var(--navy); font-weight:900; font-size:12px; display:block; margin-top:4px; }
      h1 { margin:0; color:var(--navy); text-align:right; font-size:36px; letter-spacing:.02em; font-weight:900; }
      
      .info-row { margin:15px 0; display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
      .info-box { padding:18px 16px; background:#c8e9ff; color:#06285f; border-radius:16px; text-align:center; border:2px solid rgba(12,99,199,0.22); box-shadow:0 4px 12px rgba(6,40,95,0.06); }
      .info-box span { display:block; font-size:13px; opacity:0.95; font-weight:900; color:#06285f; letter-spacing:0.05em; }
      .info-box strong { display:block; margin-top:6px; font-size:19px; font-weight:900; color:#06285f; text-shadow:0 1px 2px rgba(255,255,255,0.5); }
      
      .columns { display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px; align-items:start; }
      .column { border:1px solid var(--line); border-radius:12px; overflow:hidden; background:#fff; }
      .column h2 { margin:0; padding:10px; text-align:center; font-size:21px; font-weight:900; }
      .domestic h2 { color:var(--green); } .international h2 { color:var(--blue); } .off h2 { color:var(--gold); }
      
      .category-title { color:white; padding:6px 10px; font-size:13px; font-weight:900; text-align:center; text-transform:uppercase; }
      .domestic .category-title { background:var(--green); } .international .category-title { background:var(--blue); } .off .category-title { background:var(--gold); }
      .category-title.absent { background:var(--red); }
      
      table { width:100%; border-collapse:collapse; table-layout:fixed; }
      td { border-bottom:1px solid #e5ebf3; padding:3px 8px; font-size:12.5px; vertical-align:top; font-weight:800; color:var(--ink); }
      td:first-child { width:28px; color:var(--navy); font-weight:900; }
      .absent-row td { color:var(--red); font-weight:900; }
      .empty { color:#94a3b8; text-align:center; font-style:italic; font-weight:700; padding:4px 0; }
      
      .footer { margin:24px -30px 0; padding:16px 30px; display:flex; justify-content:space-between; color:#06285f; background:#c8e9ff; font-weight:900; font-size:13px; }
      @media print { body { background:white; } .toolbar { display:none; } #report { margin:0; border:0; box-shadow:none; width:100%; min-height:auto; } }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button onclick="downloadJpg()">Download HD JPG</button>
      <button onclick="window.print()">Print Report</button>
      <button onclick="window.close()">Close</button>
    </div>
    <section id="report">
      <header class="report-head">
        <div class="brand">
          <div>
            <strong>US-BANGLA</strong>
            <span>AIRLINES</span>
          </div>
        </div>
        <h1>AIRPORT SERVICE CSA DUTY ROSTER</h1>
      </header>
      
      <div class="info-row">
        <div class="info-box"><span>DATE</span><strong>${escapeHtml(dateLabel)} - ${escapeHtml(shift)}</strong></div>
        <div class="info-box"><span>TOTAL STAFF</span><strong>${total}</strong></div>
        <div class="info-box"><span>CREATED BY</span><strong>${escapeHtml(creator)}</strong></div>
      </div>
      
      <main class="columns">
        ${schema.map((section) => renderReportSection(section, selections, staffMap, sectionCounts[section.key], instruction, sectionCounts, total)).join("")}
      </main>
      <footer class="footer"><span>PLEASE FOLLOW AIRPORT & AIRLINE GUIDELINES</span><span>THANK YOU FOR YOUR DEDICATION & SERVICE</span></footer>
    </section>
    <script>
      async function downloadJpg() {
        const report = document.getElementById("report");
        const canvas = window.html2canvas
          ? await html2canvas(report, { scale: 3, backgroundColor: "#ffffff", useCORS: true })
          : await fallbackCanvas(report);
        const link = document.createElement("a");
        link.download = "ROSTER_${date}_${shift}.jpg";
        link.href = canvas.toDataURL("image/jpeg", 0.98);
        link.click();
      }

      function fallbackCanvas(report) {
        return new Promise((resolve, reject) => {
          const width = report.offsetWidth;
          const height = report.offsetHeight;
          const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
            '<foreignObject width="100%" height="100%">' +
            new XMLSerializer().serializeToString(report.cloneNode(true)) +
            '</foreignObject></svg>';
          const image = new Image();
          image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width * 3;
            canvas.height = height * 3;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(3, 3);
            ctx.drawImage(image, 0, 0);
            resolve(canvas);
          };
          image.onerror = reject;
          image.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
        });
      }
    </script>
  </body>
  </html>`;
}

function renderReportSection(section, selections, staffMap, count, instruction, sectionCounts, total) {
  let fieldsToRender = [...section.fields];
  let customPostContent = "";

  // ডমেস্টিক কলামের রেন্ডারিং এবং শেষে NIGHT STAFF এবং SPECIAL INSTRUCTION
  if (section.key === "domestic") {
    const nightStaffIds = selections["international.nightStaff"] || [];
    // নাম রিনেম করে "NIGHT STAFF" এবং ব্যাকগ্রাউন্ড কালার পার্পেল করা হলো
    const nightStaffMarkup = renderSpecialReportCategory("NIGHT STAFF", nightStaffIds, staffMap, "#701a75");

    customPostContent = `
      ${nightStaffMarkup}
      <div style="margin-top: 15px; border: 1px solid rgba(12,99,199,0.15); border-left: 5px solid var(--blue); border-radius: 14px; overflow: hidden; background: linear-gradient(135deg, #f0f9ff, #ffffff); box-shadow: 0 4px 12px rgba(6,40,95,0.04);">
        <h3 style="margin: 0; padding: 10px 14px; color: var(--navy); border-bottom: 1px solid rgba(12,99,199,0.1); font-size: 14px; font-weight: 900; background: rgba(200,233,255,0.3); letter-spacing: 0.05em;">DAILY SPECIAL INSTRUCTIONS</h3>
        <div style="min-height: 90px; padding: 12px 14px; white-space: pre-wrap; color: var(--navy); font-size: 13px; line-height: 1.5; font-weight: 800;">${escapeHtml(instruction || "Please follow airport and airline guidelines.")}</div>
      </div>
    `;
  }

  // আন্তর্জাতিক কলাম থেকে ৩টি বিশেষ সেকশন রেন্ডার বন্ধ রাখা
  if (section.key === "international") {
    fieldsToRender = fieldsToRender.filter(([key]) => 
      key !== "international.earlyMorningCounter" && 
      key !== "international.earlyMorningRamp" && 
      key !== "international.nightStaff"
    );
  }

  // অফ ডিউটি কলামের শেষে EARLY MORNING বক্স দুটি পার্পেল কালার ব্যাকগ্রাউন্ডে যোগ করা হলো
  if (section.key === "off") {
    const emCounterIds = selections["international.earlyMorningCounter"] || [];
    const emRampIds = selections["international.earlyMorningRamp"] || [];

    // নাম ও ব্যাকগ্রাউন্ড কালার পার্পেল করা হলো
    const emCounterMarkup = renderSpecialReportCategory("EARLY MORNING (COUNTER)", emCounterIds, staffMap, "#701a75");
    const emRampMarkup = renderSpecialReportCategory("EARLY MORNING (RAMP)", emRampIds, staffMap, "#701a75");

    customPostContent = `
      ${emCounterMarkup}
      ${emRampMarkup}
    `;
  }

  const displayCount = calculateColumnTotal(section.key, selections, fieldsToRender);

  return `
  <div style="display: flex; flex-direction: column;">
    <article class="column ${section.key}">
      <h2>${section.title} (${displayCount})</h2>
      ${fieldsToRender.map(([fieldKey, label]) => renderReportCategory(label, selections[fieldKey] || [], staffMap)).join("")}
    </article>
    ${customPostContent}
  </div>`;
}

function calculateColumnTotal(sectionKey, selections, fieldsToRender) {
  let count = fieldsToRender.reduce((sum, [key]) => sum + (selections[key] || []).length, 0);
  if (sectionKey === "domestic") {
    count += (selections["international.nightStaff"] || []).length;
  }
  if (sectionKey === "off") {
    count += (selections["international.earlyMorningCounter"] || []).length;
    count += (selections["international.earlyMorningRamp"] || []).length;
  }
  return count;
}

function renderSpecialReportCategory(label, ids, staffMap, specialBgColor) {
  const rows = ids
    .map((id) => staffMap.get(id))
    .filter(Boolean)
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
  return `
  <div class="category" style="margin-top: 10px; border: 2px dashed ${specialBgColor}; border-radius: 12px; overflow: hidden; background: #fff;">
    <div class="category-title" style="background: ${specialBgColor}; color: white; padding: 6px 10px; font-size: 13px; font-weight: 900; text-align: center; text-transform: uppercase;">${escapeHtml(label)}</div>
    <table>
      <tbody>
        ${rows.length ? rows.map((person, index) => `
          <tr>
            <td style="width: 28px; color: ${specialBgColor}; font-weight: 900; border-bottom: 1px solid #e5ebf3; padding: 4px 10px; font-size: 12.5px;">${index + 1}</td>
            <td style="font-weight: 850; color: var(--ink); border-bottom: 1px solid #e5ebf3; padding: 4px 10px; font-size: 12.5px;">${escapeHtml(person.number)} - ${escapeHtml(person.name)}</td>
          </tr>`).join("") : `<tr><td colspan="2" class="empty">No staff selected</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderReportCategory(label, ids, staffMap) {
  const isAbsent = /ABSENT/i.test(label);
  const rows = ids
    .map((id) => staffMap.get(id))
    .filter(Boolean)
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
  return `<div class="category">
    <div class="category-title ${isAbsent ? "absent" : ""}">${escapeHtml(label)}</div>
    <table>
      <tbody>
        ${rows.length ? rows.map((person, index) => `
          <tr class="${isAbsent ? "absent-row" : ""}">
            <td>${index + 1}</td>
            <td>${escapeHtml(person.number)} - ${escapeHtml(person.name)}</td>
          </tr>`).join("") : `<tr><td colspan="2" class="empty">No staff selected</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}
