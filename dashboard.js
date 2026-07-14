// Dashboard Logic controlling overview analysis, SVG charts, simulator, and data interactions

document.addEventListener('DOMContentLoaded', async () => {
  // Ensure we have seeded data
  await storage.seedDemoDataIfEmpty();

  // --- UI Elements ---
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const btnRefresh = document.getElementById('btn-refresh');

  // Stats elements
  const statTotalCf = document.getElementById('stat-total-cf');
  const statTotalEnergy = document.getElementById('stat-total-energy');
  const statAvgSec = document.getElementById('stat-avg-sec');
  const statAvgYield = document.getElementById('stat-avg-yield');

  // Table element
  const batchTableBody = document.getElementById('batch-table-body');

  // Hotspots element
  const dashboardHotspotsList = document.getElementById('dashboard-hotspots-list');

  // Simulator elements
  const simMaterial = document.getElementById('sim-material');
  const simWeight = document.getElementById('sim-weight');
  const simRecycled = document.getElementById('sim-recycled');
  const simSec = document.getElementById('sim-sec');
  const simScrap = document.getElementById('sim-scrap');

  const valSimWeight = document.getElementById('val-sim-weight');
  const valSimRecycled = document.getElementById('val-sim-recycled');
  const valSimSec = document.getElementById('val-sim-sec');
  const valSimScrap = document.getElementById('val-sim-scrap');

  const simResTotalCf = document.getElementById('sim-res-total-cf');
  const simResMaterialSplit = document.getElementById('sim-res-material-split');
  const simResIntensity = document.getElementById('sim-res-intensity');
  const simSavingBox = document.getElementById('sim-saving-box');
  const simSavedPercent = document.getElementById('sim-saved-percent');
  const simSavedKg = document.getElementById('sim-saved-kg');

  // Modal elements
  const detailModal = document.getElementById('detail-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalContentBody = document.getElementById('modal-content-body');
  const modalTitle = document.getElementById('modal-title');

  // --- View Switching ---
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      viewPanels.forEach(p => p.classList.add('hidden'));

      item.classList.add('active');
      const targetView = item.getAttribute('data-view');
      document.getElementById(targetView).classList.remove('hidden');
    });
  });

  // --- Load and Render Dashboard Data ---
  async function loadDashboardData() {
    const batches = await storage.getBatches();
    
    // Sort batches by date descending for table
    const sortedBatches = [...batches].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 1. Calculate Summary Stats
    let totalCf = 0;
    let totalEnergy = 0;
    let totalSecWeight = 0;
    let totalSecElectricity = 0;
    let recyclingYieldSum = 0;
    let recyclingCount = 0;

    sortedBatches.forEach(batch => {
      const calc = batch.calculations || {};
      totalCf += calc.totalFootprint || 0;
      
      if (batch.processType === 'recycling') {
        totalEnergy += calc.totalElectricity || 0;
        recyclingYieldSum += calc.yieldPercentage || 0;
        recyclingCount++;
      } else {
        totalEnergy += batch.electricityConsumed || 0;
        totalSecWeight += batch.totalMaterialWeight || 0;
        totalSecElectricity += batch.electricityConsumed || 0;
      }
    });

    statTotalCf.textContent = `${totalCf.toLocaleString(undefined, {maximumFractionDigits: 1})} kg`;
    statTotalEnergy.textContent = `${totalEnergy.toLocaleString(undefined, {maximumFractionDigits: 0})} kWh`;
    
    const avgSec = totalSecWeight > 0 ? (totalSecElectricity / totalSecWeight) : 0;
    statAvgSec.textContent = `${avgSec.toFixed(2)} kWh/kg`;
    
    const avgYield = recyclingCount > 0 ? (recyclingYieldSum / recyclingCount) : 0;
    statAvgYield.textContent = `${avgYield.toFixed(1)}%`;

    // 2. Render SVG Charts
    renderMaterialChart(sortedBatches);
    renderProcessChart(sortedBatches);

    // 3. Render Batches Table
    renderBatchesTable(sortedBatches);

    // 4. Render Global Hotspots Tab
    renderHotspotsView(sortedBatches);
  }

  // --- Render Material Bar Chart (SVG) ---
  function renderMaterialChart(batches) {
    const svg = document.getElementById('material-chart');
    svg.innerHTML = ''; // Clear previous

    // Aggregate carbon by material type (PP, PE, PVC, PET, ABS, PLA)
    const materialData = {
      PP: 0,
      HDPE: 0,
      LDPE: 0,
      PVC: 0,
      PET: 0,
      ABS: 0
    };

    batches.forEach(b => {
      // For recycling, we map to material PP for demo or skip
      const mat = b.materialType;
      if (mat && materialData[mat] !== undefined) {
        materialData[mat] += b.calculations?.totalFootprint || 0;
      }
    });

    const matKeys = Object.keys(materialData);
    const matVals = Object.values(materialData);
    const maxVal = Math.max(...matVals, 100); // minimum scale limit to avoid division by 0

    // Chart dimensions
    const width = 500;
    const height = 220;
    const paddingLeft = 50;
    const paddingBottom = 40;
    const chartHeight = height - paddingBottom - 20;
    const chartWidth = width - paddingLeft - 20;
    const barWidth = 40;
    const spacing = (chartWidth - barWidth * matKeys.length) / (matKeys.length + 1);

    // Draw axis lines
    const axisY = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisY.setAttribute('x1', paddingLeft);
    axisY.setAttribute('y1', 20);
    axisY.setAttribute('x2', paddingLeft);
    axisY.setAttribute('y2', height - paddingBottom);
    axisY.setAttribute('stroke', 'rgba(255,255,255,0.1)');
    svg.appendChild(axisY);

    const axisX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisX.setAttribute('x1', paddingLeft);
    axisX.setAttribute('y1', height - paddingBottom);
    axisX.setAttribute('x2', width - 20);
    axisX.setAttribute('y2', height - paddingBottom);
    axisX.setAttribute('stroke', 'rgba(255,255,255,0.1)');
    svg.appendChild(axisX);

    // Draw bars and labels
    matKeys.forEach((key, index) => {
      const val = materialData[key];
      const barHeight = (val / maxVal) * chartHeight;
      const x = paddingLeft + spacing + index * (barWidth + spacing);
      const y = height - paddingBottom - barHeight;

      // Draw Bar
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barWidth);
      rect.setAttribute('height', Math.max(barHeight, 2)); // visible minimum bar
      rect.setAttribute('class', 'svg-bar');
      
      // Customize bar colors based on material carbon density
      if (key === 'ABS' || key === 'PVC') {
        rect.style.fill = 'var(--accent-rose)'; // High carbon
      } else {
        rect.style.fill = 'var(--accent-emerald)'; // Low carbon
      }
      svg.appendChild(rect);

      // Label X-Axis
      const textX = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textX.setAttribute('x', x + barWidth / 2);
      textX.setAttribute('y', height - paddingBottom + 18);
      textX.setAttribute('class', 'svg-text');
      textX.textContent = key;
      svg.appendChild(textX);

      // Value text on top of bar
      const textVal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textVal.setAttribute('x', x + barWidth / 2);
      textVal.setAttribute('y', y - 8);
      textVal.setAttribute('class', 'svg-text');
      textVal.style.fill = 'var(--text-primary)';
      textVal.style.fontWeight = '500';
      textVal.textContent = val > 0 ? `${val.toFixed(0)}` : '0';
      svg.appendChild(textVal);
    });

    // Y Axis indicators (0, 50%, 100%)
    const yGridValues = [0, maxVal / 2, maxVal];
    yGridValues.forEach(gridVal => {
      const yPos = height - paddingBottom - (gridVal / maxVal) * chartHeight;
      const textY = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textY.setAttribute('x', paddingLeft - 10);
      textY.setAttribute('y', yPos + 4);
      textY.setAttribute('class', 'svg-text');
      textY.style.textAnchor = 'end';
      textY.textContent = gridVal.toFixed(0);
      svg.appendChild(textY);
    });
  }

  // --- Render Process Distribution Chart (SVG) ---
  function renderProcessChart(batches) {
    const svg = document.getElementById('process-chart');
    svg.innerHTML = '';

    // Aggregate electricity by process type
    const processData = {
      injection: 0,
      extrusion: 0,
      forming: 0,
      recycling: 0
    };

    batches.forEach(b => {
      const proc = b.processType;
      if (proc && processData[proc] !== undefined) {
        if (proc === 'recycling') {
          processData[proc] += b.calculations?.totalElectricity || 0;
        } else {
          processData[proc] += b.electricityConsumed || 0;
        }
      }
    });

    const procKeys = Object.keys(processData);
    const procNames = {
      injection: 'ฉีดพลาสติก',
      extrusion: 'รีดแผ่น/ท่อ',
      forming: 'ขึ้นรูป',
      recycling: 'รีไซเคิล'
    };
    const procColors = {
      injection: 'var(--accent-cyan)',
      extrusion: 'var(--accent-emerald)',
      forming: 'var(--accent-amber)',
      recycling: '#8b5cf6' // Violet for recycling
    };

    const totalElectricitySum = Object.values(processData).reduce((a, b) => a + b, 0) || 1;

    // Draw horizontal progress bars representing percentages
    const height = 220;
    const width = 300;
    const paddingLeft = 70;
    const chartWidth = width - paddingLeft - 30;

    procKeys.forEach((key, index) => {
      const val = processData[key];
      const percentage = (val / totalElectricitySum) * 100;
      const y = 30 + index * 45;
      const barHeight = 12;
      const barWidth = (percentage / 100) * chartWidth;

      // Draw label text
      const textLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textLabel.setAttribute('x', paddingLeft - 10);
      textLabel.setAttribute('y', y + barHeight - 1);
      textLabel.setAttribute('class', 'svg-text');
      textLabel.style.textAnchor = 'end';
      textLabel.style.fontSize = '11px';
      textLabel.textContent = procNames[key];
      svg.appendChild(textLabel);

      // Draw background bar track
      const rectBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rectBg.setAttribute('x', paddingLeft);
      rectBg.setAttribute('y', y);
      rectBg.setAttribute('width', chartWidth);
      rectBg.setAttribute('height', barHeight);
      rectBg.setAttribute('fill', 'rgba(255,255,255,0.03)');
      rectBg.setAttribute('rx', 3);
      svg.appendChild(rectBg);

      // Draw actual filled progress bar
      if (barWidth > 0) {
        const rectFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rectFill.setAttribute('x', paddingLeft);
        rectFill.setAttribute('y', y);
        rectFill.setAttribute('width', barWidth);
        rectFill.setAttribute('height', barHeight);
        rectFill.setAttribute('fill', procColors[key]);
        rectFill.setAttribute('rx', 3);
        svg.appendChild(rectFill);
      }

      // Draw percentage value text
      const textVal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textVal.setAttribute('x', paddingLeft + chartWidth + 5);
      textVal.setAttribute('y', y + barHeight - 1);
      textVal.setAttribute('class', 'svg-text');
      textVal.style.textAnchor = 'start';
      textVal.style.fontWeight = '500';
      textVal.textContent = `${percentage.toFixed(0)}%`;
      svg.appendChild(textVal);
    });
  }

  // --- Render Batches Table ---
  function renderBatchesTable(batches) {
    batchTableBody.innerHTML = '';

    if (batches.length === 0) {
      batchTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 30px 0;">
            ยังไม่มีบันทึกข้อมูลการผลิต กรุณากรอกข้อมูลในส่วนของ Extension Side Panel
          </td>
        </tr>
      `;
      return;
    }

    const processBadges = {
      injection: '<span class="badge badge-cyan">ฉีดพลาสติก</span>',
      extrusion: '<span class="badge badge-emerald">รีดแผ่น/ท่อ</span>',
      forming: '<span class="badge badge-amber">ขึ้นรูป</span>',
      recycling: '<span class="badge" style="background:#8b5cf6; color:white;">รีไซเคิลหลอมเม็ด</span>'
    };

    batches.forEach(b => {
      const row = document.createElement('tr');
      row.style.cursor = 'pointer';
      
      const calc = b.calculations || {};
      const totalCfVal = calc.totalFootprint || 0;
      const date = new Date(b.timestamp).toLocaleDateString('th-TH', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const weight = b.processType === 'recycling' ? b.inputScrapWeight : b.totalMaterialWeight;
      const electricity = b.processType === 'recycling' ? calc.totalElectricity : b.electricityConsumed;

      // Hotspots count badge
      const hotspotsCount = calc.hotspots?.length || 0;
      const hotspotsHtml = hotspotsCount > 0 
        ? `<span class="badge badge-rose">⚠️ ${hotspotsCount} Hotspot</span>`
        : `<span class="badge badge-emerald">✅ ปกติ</span>`;

      row.innerHTML = `
        <td>${date}</td>
        <td style="font-weight: 500;">${b.batchName || '-'}</td>
        <td>${processBadges[b.processType]}</td>
        <td class="calc-val">${weight ? weight.toLocaleString() : '0'} kg</td>
        <td class="calc-val">${electricity ? electricity.toLocaleString() : '0'} kWh</td>
        <td class="calc-val" style="font-weight:600; color: ${hotspotsCount > 0 ? 'var(--text-primary)' : 'var(--accent-emerald)'}">
          ${totalCfVal.toLocaleString(undefined, {maximumFractionDigits: 1})}
        </td>
        <td>${hotspotsHtml}</td>
        <td>
          <button class="btn btn-secondary btn-delete-batch" data-id="${b.id}" style="padding: 4px 8px; font-size:11px;">🗑️ ลบ</button>
        </td>
      `;

      // Click row to show details (except when clicking delete button)
      row.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn-delete-batch')) {
          showBatchDetailsModal(b);
        }
      });

      batchTableBody.appendChild(row);
    });

    // Wire up delete buttons
    document.querySelectorAll('.btn-delete-batch').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // prevent modal opening
        const id = btn.getAttribute('data-id');
        if (confirm('คุณต้องการลบข้อมูลล็อตการผลิตนี้ใช่หรือไม่?')) {
          await storage.deleteBatch(id);
          await loadDashboardData();
        }
      });
    });
  }

  // --- Render Hotspots View Tab ---
  function renderHotspotsView(batches) {
    dashboardHotspotsList.innerHTML = '';
    
    // Aggregate all active hotspots across all batches
    const activeHotspots = [];
    batches.forEach(b => {
      const calc = b.calculations || {};
      if (calc.hotspots && calc.hotspots.length > 0) {
        calc.hotspots.forEach(h => {
          activeHotspots.push({
            ...h,
            batchName: b.batchName,
            timestamp: b.timestamp
          });
        });
      }
    });

    if (activeHotspots.length === 0) {
      dashboardHotspotsList.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 40px 0;">
          🎉 ไม่พบจุดปล่อยคาร์บอนวิกฤต (Hotspot) ในระบบ การดำเนินงานของโรงงานเป็นปกติและเป็นมิตรต่อสิ่งแวดล้อม
        </div>
      `;
      return;
    }

    activeHotspots.forEach(hotspot => {
      const date = new Date(hotspot.timestamp).toLocaleDateString('th-TH', {
        month: 'short',
        day: 'numeric'
      });

      const item = document.createElement('div');
      item.className = `hotspot-item severity-${hotspot.severity}`;
      item.style.marginBottom = '14px';
      
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="hotspot-title">⚠️ ${hotspot.title}</div>
          <span style="font-size:11px; color:var(--text-muted);">ล็อต: ${hotspot.batchName} (${date})</span>
        </div>
        <div class="hotspot-desc" style="margin-top:4px;">${hotspot.description}</div>
        <div class="hotspot-rec" style="margin-top:6px;">💡 <strong>แนวทางแก้ไขแนะโดย AI:</strong> ${hotspot.recommendation}</div>
      `;
      
      dashboardHotspotsList.appendChild(item);
    });
  }

  // --- Detail Modal Dialog ---
  function showBatchDetailsModal(batch) {
    const calc = batch.calculations || {};
    modalTitle.textContent = `🔍 รายละเอียด: ${batch.batchName || 'ล็อตผลิตไม่ระบุชื่อ'}`;
    
    const date = new Date(batch.timestamp).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let detailsHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div>
          <strong style="color:var(--text-secondary);">วันที่บันทึก:</strong> ${date}
        </div>
        <div>
          <strong style="color:var(--text-secondary);">กระบวนการผลิต:</strong> 
          ${batch.processType === 'injection' ? 'การฉีดพลาสติก' : 
            batch.processType === 'extrusion' ? 'การรีดแผ่น/ท่อ' : 
            batch.processType === 'forming' ? 'การขึ้นรูป' : 'รีไซเคิลหลอมเม็ด'}
        </div>
      </div>
      <hr style="border:none; border-top:1px solid var(--panel-border); margin:12px 0;">
    `;

    if (batch.processType === 'recycling') {
      detailsHtml += `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">
          <div>เศษพลาสติกนำเข้า: <strong>${batch.inputScrapWeight.toLocaleString()} kg</strong></div>
          <div>เม็ดรีไซเคิลผลิตได้: <strong>${batch.outputPelletsWeight.toLocaleString()} kg</strong></div>
          <div>อัตรา Yield การรีไซเคิล: <strong style="color:var(--accent-emerald);">${calc.yieldPercentage.toFixed(1)}%</strong></div>
          <div>ปริมาณน้ำประปาที่ใช้: <strong>${batch.waterConsumed.toLocaleString()} ลิตร</strong></div>
          <div>ความเข้มข้นการใช้น้ำ (Water Intensity): <strong>${calc.waterIntensity.toFixed(2)} ลิตร/kg</strong></div>
          <div>พลังงานไฟฟ้ารวม: <strong>${calc.totalElectricity.toLocaleString()} kWh</strong> (ประสิทธิภาพไฟฟ้า: <strong>${calc.sec.toFixed(2)} kWh/kg</strong>)</div>
        </div>
      `;
    } else {
      detailsHtml += `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">
          <div>วัตถุดิบหลัก: <strong>${batch.materialType}</strong></div>
          <div>น้ำหนักวัตถุดิบทั้งหมด: <strong>${batch.totalMaterialWeight.toLocaleString()} kg</strong></div>
          <div>สัดส่วนเม็ดรีไซเคิลผสม: <strong style="color:var(--accent-emerald);">${batch.recycledContentPercentage}%</strong></div>
          <div>ประเภทเครื่องจักร: <strong>${batch.machineType}</strong></div>
          <div>กำลังไฟฟ้าที่เครื่องใช้: <strong>${batch.electricityConsumed.toLocaleString()} kWh</strong></div>
          <div>ประสิทธิภาพไฟฟ้าใช้งาน (SEC): <strong>${calc.sec.toFixed(2)} kWh/kg</strong> (เกณฑ์มาตรฐาน: ${calc.benchmarkSec} kWh/kg)</div>
          <div>อัตราเศษเสียชิ้นงาน: <strong>${batch.scrapPercentage}%</strong> (คิดเป็นน้ำหนักงานเสีย: ${calc.scrapWeight.toFixed(1)} kg)</div>
        </div>
      `;
    }

    detailsHtml += `
      <hr style="border:none; border-top:1px solid var(--panel-border); margin:12px 0;">
      <div class="glass-card" style="background:rgba(16,185,129,0.02); border-color:rgba(16,185,129,0.2);">
        <h4 style="margin-bottom:8px; color:var(--accent-emerald);">คาร์บอนฟุตพริ้นท์วิเคราะห์ (Carbon Footprint Analysis)</h4>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span>คาร์บอนวัตถุดิบ (Scope 3 Upstream):</span>
          <span>${batch.processType === 'recycling' ? '0.0' : calc.rawMaterialFootprint.toFixed(1)} kg CO2e</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span>คาร์บอนจากการใช้ไฟฟ้า (Scope 2):</span>
          <span>${calc.processingFootprint.toFixed(1)} kg CO2e</span>
        </div>
        ${batch.processType === 'recycling' ? `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span>คาร์บอนจากการใช้น้ำประปา (Scope 3):</span>
          <span>${calc.waterEmissions.toFixed(2)} kg CO2e</span>
        </div>` : ''}
        <div style="display:flex; justify-content:space-between; margin-top:8px; border-top:1px solid rgba(255,255,255,0.06); padding-top:6px; font-weight:700;">
          <span>คาร์บอนฟุตพริ้นท์รวม (Total CF):</span>
          <span style="color:var(--accent-emerald);">${calc.totalFootprint.toFixed(1)} kg CO2e</span>
        </div>
        ${batch.processType !== 'recycling' ? `
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-weight:700;">
          <span>ค่าความเข้มคาร์บอนเฉลี่ย (Carbon Intensity):</span>
          <span style="color:var(--accent-emerald);">${calc.carbonIntensity.toFixed(2)} kg CO2e/kg ชิ้นงาน</span>
        </div>` : ''}
      </div>
    `;

    // Hotspots list in modal
    if (calc.hotspots && calc.hotspots.length > 0) {
      detailsHtml += `
        <div style="margin-top:16px;">
          <h4 style="color:#fbbf24; margin-bottom:8px;">⚠️ ตรวจพบจุดวิกฤตคาร์บอน (Hotspots):</h4>
          <div class="hotspot-list">
            ${calc.hotspots.map(h => `
              <div class="hotspot-item severity-${h.severity}" style="padding:10px;">
                <div class="hotspot-title" style="font-size:12px;">⚠️ ${h.title}</div>
                <div class="hotspot-desc" style="font-size:11px; margin-bottom:4px;">${h.description}</div>
                <div class="hotspot-rec" style="font-size:11px; padding:4px 8px;">💡 ${h.recommendation}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    modalContentBody.innerHTML = detailsHtml;
    detailModal.style.display = 'flex';
  }

  btnCloseModal.addEventListener('click', () => {
    detailModal.style.display = 'none';
  });

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === detailModal) {
      detailModal.style.display = 'none';
    }
  });

  // --- Eco-Simulator logic ---
  function updateSimulation() {
    const mat = simMaterial.value;
    const weight = parseFloat(simWeight.value) || 0;
    const recycled = parseFloat(simRecycled.value) || 0;
    const sec = parseFloat(simSec.value) || 0;
    const scrap = parseFloat(simScrap.value) || 0;

    valSimWeight.textContent = `${weight.toLocaleString()} kg`;
    valSimRecycled.textContent = `${recycled}%`;
    valSimSec.textContent = `${sec.toFixed(2)} kWh/kg`;
    valSimScrap.textContent = `${scrap}%`;

    // Calculate simulated carbon using standard formula
    const calcData = {
      processType: 'injection', // simulate injection molding
      materialType: mat,
      totalMaterialWeight: weight,
      recycledContentPercentage: recycled,
      machineType: 'custom',
      electricityConsumed: weight * sec,
      scrapPercentage: scrap
    };

    const result = carbonCalculator.calculateManufacturing(calcData);

    simResTotalCf.textContent = `${result.totalFootprint.toLocaleString(undefined, {maximumFractionDigits: 1})} kg CO2e`;
    
    const matPct = result.totalFootprint > 0 ? (result.rawMaterialFootprint / result.totalFootprint) * 100 : 0;
    const energyPct = result.totalFootprint > 0 ? (result.processingFootprint / result.totalFootprint) * 100 : 0;
    simResMaterialSplit.textContent = `สัดส่วน คาร์บอนวัตถุดิบ: ${matPct.toFixed(0)}% | ไฟฟ้ากระบวนการ: ${energyPct.toFixed(0)}%`;
    
    simResIntensity.textContent = `${result.carbonIntensity.toFixed(2)} kg CO2e/kg ชิ้นงาน`;

    // Calculate savings compared to a Baseline (Baseline: 100% Virgin material, SEC 1.2, Scrap 5%)
    const baselineData = {
      processType: 'injection',
      materialType: mat,
      totalMaterialWeight: weight,
      recycledContentPercentage: 0, // Baseline is 0% recycled
      machineType: 'hydraulic',
      electricityConsumed: weight * 1.2, // SEC 1.2
      scrapPercentage: 5 // Scrap 5%
    };
    
    const baselineResult = carbonCalculator.calculateManufacturing(baselineData);
    const difference = baselineResult.totalFootprint - result.totalFootprint;
    const savingPercent = baselineResult.totalFootprint > 0 ? (difference / baselineResult.totalFootprint) * 100 : 0;

    if (difference > 10) {
      simSavingBox.style.display = 'block';
      simSavedPercent.textContent = `${savingPercent.toFixed(0)}%`;
      simSavedKg.textContent = `${difference.toLocaleString(undefined, {maximumFractionDigits: 0})} kg CO2e`;
    } else {
      simSavingBox.style.display = 'none';
    }
  }

  // Attach simulator listeners
  [simMaterial, simWeight, simRecycled, simSec, simScrap].forEach(el => {
    el.addEventListener('input', updateSimulation);
  });

  // Init simulation
  updateSimulation();

  // Wire up refresh button
  btnRefresh.addEventListener('click', async () => {
    await loadDashboardData();
    alert('รีเฟรชข้อมูลสำเร็จ!');
  });

  // Load initially
  await loadDashboardData();
});
