// Sidepanel Logic controlling form input, AI OCR, and Chatbot interactions

document.addEventListener('DOMContentLoaded', async () => {
  // --- Initialization & Seeding ---
  await storage.seedDemoDataIfEmpty();
  
  // --- UI Elements ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const selectProcess = document.getElementById('select-process');
  const mfgFields = document.getElementById('mfg-fields');
  const recyclingFields = document.getElementById('recycling-fields');
  
  const batchForm = document.getElementById('batch-form');
  const quickResultCard = document.getElementById('quick-result-card');
  const resTotalCf = document.getElementById('res-total-cf');
  const resIntensity = document.getElementById('res-intensity');
  const resRowIntensity = document.getElementById('res-row-intensity');
  const resRowYield = document.getElementById('res-row-yield');
  const resYield = document.getElementById('res-yield');
  const resSec = document.getElementById('res-sec');
  const quickHotspotArea = document.getElementById('quick-hotspot-area');
  const quickHotspotsContainer = document.getElementById('quick-hotspots-container');
  const btnConsultHotspots = document.getElementById('btn-consult-hotspots');
  
  // Settings Panel
  const btnSettings = document.getElementById('btn-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  
  // OCR elements
  const ocrUploader = document.getElementById('ocr-uploader');
  const ocrFileInput = document.getElementById('ocr-file-input');
  const ocrStatusText = document.getElementById('ocr-status-text');
  
  // Chat Elements
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatTextInput = document.getElementById('chat-text-input');
  const btnChatSend = document.getElementById('btn-chat-send');
  
  // Navigation
  const btnDashboard = document.getElementById('btn-dashboard');

  let currentCalculations = null;
  let currentFormBatch = null;

  // --- Load Settings ---
  const savedSettings = await storage.getSettings();
  if (savedSettings && savedSettings.geminiApiKey) {
    apiKeyInput.value = savedSettings.geminiApiKey;
  }

  // --- Navigation & Dashboard Trigger ---
  btnDashboard.addEventListener('click', () => {
    // Open full dashboard in a new tab
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'dashboard.html' });
    } else {
      window.open('dashboard.html', '_blank');
    }
  });

  // --- Tab Switching ---
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // --- Settings Panel controls ---
  btnSettings.addEventListener('click', () => {
    settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';
  });
  
  btnCloseSettings.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
  });
  
  btnSaveSettings.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    await storage.saveSettings({ geminiApiKey: key });
    alert('บันทึก API Key เรียบร้อยแล้ว!');
    settingsPanel.style.display = 'none';
  });

  // --- Form Field Toggling based on Process ---
  selectProcess.addEventListener('change', () => {
    const process = selectProcess.value;
    if (process === 'recycling') {
      mfgFields.classList.add('hidden');
      recyclingFields.classList.remove('hidden');
    } else {
      mfgFields.classList.remove('hidden');
      recyclingFields.classList.add('hidden');
    }
    quickResultCard.classList.add('hidden');
  });

  // --- OCR / File Dropzone handlers ---
  ocrUploader.addEventListener('click', () => {
    ocrFileInput.click();
  });

  // Drag and drop events
  ocrUploader.addEventListener('dragover', (e) => {
    e.preventDefault();
    ocrUploader.classList.add('dragover');
  });

  ocrUploader.addEventListener('dragleave', () => {
    ocrUploader.classList.remove('dragover');
  });

  ocrUploader.addEventListener('drop', (e) => {
    e.preventDefault();
    ocrUploader.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleOcrFile(e.dataTransfer.files[0]);
    }
  });

  ocrFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleOcrFile(e.target.files[0]);
    }
  });

  async function handleOcrFile(file) {
    const settings = await storage.getSettings();
    if (!settings.geminiApiKey) {
      alert('กรุณาตั้งค่า Gemini API Key ก่อนใช้ฟีเจอร์ AI OCR บิล/รายงาน');
      settingsPanel.style.display = 'block';
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('รองรับเฉพาะไฟล์รูปภาพ (PNG, JPG, WebP) ในการสแกน');
      return;
    }

    ocrStatusText.textContent = 'กำลังส่งวิเคราะห์ด้วย Gemini AI...';
    ocrUploader.style.borderColor = 'var(--accent-amber)';

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(',')[1];
        const result = await aiService.parseProductionDocument(
          settings.geminiApiKey,
          base64Data,
          file.type
        );

        if (result && result.success) {
          fillFormFromOcr(result);
          ocrStatusText.textContent = 'ถอดความข้อมูลจากรูปสำเร็จ!';
          ocrUploader.style.borderColor = 'var(--accent-emerald)';
          setTimeout(() => {
            ocrStatusText.textContent = 'ลากไฟล์รายงานการผลิตหรือรูปมิเตอร์ไฟฟ้ามาวางที่นี่';
            ocrUploader.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }, 3000);
        } else {
          throw new Error('โครงสร้างคำตอบของ AI ไม่ถูกต้อง');
        }
      } catch (err) {
        console.error(err);
        ocrStatusText.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
        ocrUploader.style.borderColor = 'var(--accent-rose)';
      }
    };
    reader.readAsDataURL(file);
  }

  function fillFormFromOcr(data) {
    if (data.batchName) document.getElementById('input-batch-name').value = data.batchName;
    if (data.processType) {
      selectProcess.value = data.processType;
      // trigger change event to toggle forms
      selectProcess.dispatchEvent(new Event('change'));
    }

    if (data.processType === 'recycling') {
      if (data.totalMaterialWeight) document.getElementById('input-scrap-weight').value = data.totalMaterialWeight;
      // If we got outputs
      if (data.outputPelletsWeight) {
        document.getElementById('input-pellets-weight').value = data.outputPelletsWeight;
      } else if (data.totalMaterialWeight && data.scrapPercentage) {
        const pellets = data.totalMaterialWeight * (1 - data.scrapPercentage / 100);
        document.getElementById('input-pellets-weight').value = pellets.toFixed(0);
      }
      if (data.electricityConsumed) {
        // distribute electricity for the recycling inputs as placeholder
        const total = data.electricityConsumed;
        document.getElementById('input-shredder').value = (total * 0.1).toFixed(0);
        document.getElementById('input-washing').value = (total * 0.3).toFixed(0);
        document.getElementById('input-pelletizer').value = (total * 0.6).toFixed(0);
      }
      if (data.waterConsumed) document.getElementById('input-water').value = data.waterConsumed;
    } else {
      if (data.materialType) document.getElementById('select-material').value = data.materialType;
      if (data.totalMaterialWeight) document.getElementById('input-material-weight').value = data.totalMaterialWeight;
      if (data.recycledContentPercentage) document.getElementById('input-recycled-pct').value = data.recycledContentPercentage;
      if (data.electricityConsumed) document.getElementById('input-electricity').value = data.electricityConsumed;
      if (data.scrapPercentage) document.getElementById('input-scrap-pct').value = data.scrapPercentage;
    }
  }

  // --- Form Submission & Local Calculations ---
  batchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const process = selectProcess.value;
    const batchName = document.getElementById('input-batch-name').value.trim();
    
    let calcResults = null;
    let batchData = {
      processType: process,
      batchName: batchName,
      timestamp: new Date().toISOString()
    };

    if (process === 'recycling') {
      const inputScrapWeight = parseFloat(document.getElementById('input-scrap-weight').value) || 0;
      const outputPelletsWeight = parseFloat(document.getElementById('input-pellets-weight').value) || 0;
      const shredderEnergy = parseFloat(document.getElementById('input-shredder').value) || 0;
      const washerEnergy = parseFloat(document.getElementById('input-washing').value) || 0;
      const dryerEnergy = parseFloat(document.getElementById('input-washing').value) * 0.4 || 0; // dryer is subset of washing in form
      const pelletizerEnergy = parseFloat(document.getElementById('input-pelletizer').value) || 0;
      const waterConsumed = parseFloat(document.getElementById('input-water').value) || 0;

      const calcData = {
        inputScrapWeight,
        outputPelletsWeight,
        shredderEnergy,
        washerEnergy,
        dryerEnergy,
        pelletizerEnergy,
        waterConsumed
      };

      calcResults = carbonCalculator.calculateRecycling(calcData);
      
      batchData = {
        ...batchData,
        ...calcData,
        calculations: calcResults
      };
    } else {
      const materialType = document.getElementById('select-material').value;
      const totalMaterialWeight = parseFloat(document.getElementById('input-material-weight').value) || 0;
      const recycledContentPercentage = parseFloat(document.getElementById('input-recycled-pct').value) || 0;
      const machineType = document.getElementById('select-machine').value;
      const electricityConsumed = parseFloat(document.getElementById('input-electricity').value) || 0;
      const scrapPercentage = parseFloat(document.getElementById('input-scrap-pct').value) || 0;

      const calcData = {
        processType: process,
        materialType,
        totalMaterialWeight,
        recycledContentPercentage,
        machineType,
        electricityConsumed,
        scrapPercentage
      };

      calcResults = carbonCalculator.calculateManufacturing(calcData);

      batchData = {
        ...batchData,
        ...calcData,
        calculations: calcResults
      };
    }

    currentCalculations = calcResults;
    currentFormBatch = batchData;

    // Save to storage
    await storage.saveBatch(batchData);

    // Update UI Results Card
    resTotalCf.textContent = `${calcResults.totalFootprint.toLocaleString(undefined, {maximumFractionDigits: 1})} kg CO2e`;
    resSec.textContent = `${calcResults.sec.toFixed(2)} kWh/kg`;
    
    if (process === 'recycling') {
      resRowIntensity.classList.add('hidden');
      resRowYield.classList.remove('hidden');
      resYield.textContent = `${calcResults.yieldPercentage.toFixed(1)}%`;
    } else {
      resRowIntensity.classList.remove('hidden');
      resRowYield.classList.add('hidden');
      resIntensity.textContent = `${calcResults.carbonIntensity.toFixed(2)} kg CO2e/kg`;
    }

    // Populate Hotspots in results card
    quickHotspotsContainer.innerHTML = '';
    if (calcResults.hotspots && calcResults.hotspots.length > 0) {
      quickHotspotArea.style.display = 'block';
      calcResults.hotspots.forEach(hotspot => {
        const item = document.createElement('div');
        item.className = `hotspot-item severity-${hotspot.severity}`;
        item.innerHTML = `
          <div class="hotspot-title">⚠️ ${hotspot.title}</div>
          <div class="hotspot-desc">${hotspot.description}</div>
          <div class="hotspot-rec">💡 ${hotspot.recommendation}</div>
        `;
        quickHotspotsContainer.appendChild(item);
      });
    } else {
      quickHotspotArea.style.display = 'none';
    }

    quickResultCard.classList.remove('hidden');
    
    // Smooth scroll down to result card
    quickResultCard.scrollIntoView({ behavior: 'smooth' });
  });

  // --- AI Expert Advice from Hotspot click ---
  btnConsultHotspots.addEventListener('click', async () => {
    if (!currentFormBatch) return;

    const settings = await storage.getSettings();
    if (!settings.geminiApiKey) {
      alert('กรุณาตั้งค่า Gemini API Key ก่อนขอวิเคราะห์แผนปฏิบัติการลดคาร์บอน');
      settingsPanel.style.display = 'block';
      return;
    }

    // Switch to Chat Tab
    document.querySelector('.tab-btn[data-tab="chat-tab"]').click();
    
    // Add user message indicating request
    appendChatMessage('user', `ขอคำแนะนำการแก้ไขจุด Hotspot คาร์บอนสำหรับล็อต "${currentFormBatch.batchName}" หน่อยครับ`);
    
    // Show AI typing placeholder
    const typingId = appendChatMessage('assistant', 'กำลังวิเคราะห์ข้อมูลการปล่อยคาร์บอนและวิศวกรรมการผลิตเพื่อจัดทำแนวทางแก้ไข...');

    try {
      const advice = await aiService.getHotspotAdvice(settings.geminiApiKey, currentFormBatch);
      // Remove typing bubble and append actual advice
      removeChatMessage(typingId);
      appendChatMessage('assistant', advice);
    } catch (err) {
      console.error(err);
      removeChatMessage(typingId);
      appendChatMessage('assistant', 'เกิดข้อผิดพลาดในการรับวิเคราะห์แผนลดคาร์บอน: ' + err.message);
    }
  });

  // --- AI Chatbot Interface ---
  btnChatSend.addEventListener('click', () => sendUserChatMessage());
  chatTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendUserChatMessage();
    }
  });

  async function sendUserChatMessage() {
    const text = chatTextInput.value.trim();
    if (!text) return;

    const settings = await storage.getSettings();
    if (!settings.geminiApiKey) {
      alert('กรุณาตั้งค่า Gemini API Key ในส่วนการตั้งค่าก่อนแชทกับ AI Advisor');
      settingsPanel.style.display = 'block';
      return;
    }

    appendChatMessage('user', text);
    chatTextInput.value = '';

    const typingId = appendChatMessage('assistant', 'กำลังพิมพ์คำแนะนำ...');

    try {
      // Gather current data for context
      const batches = await storage.getBatches();
      let summary = "No production batches logged yet.";
      if (batches.length > 0) {
        summary = batches.slice(-5).map(b => {
          return `- ล็อต: ${b.batchName}, กระบวนการ: ${b.processType}, คาร์บอนรวม: ${b.calculations?.totalFootprint.toFixed(1)} kg CO2e, มี Hotspots: ${b.calculations?.hotspots?.length || 0} รายการ`;
        }).join('\n');
      }

      // Build message history
      const messageHistory = getChatHistoryForAPI();

      const responseText = await aiService.chatWithAdvisor(settings.geminiApiKey, messageHistory, summary);
      removeChatMessage(typingId);
      appendChatMessage('assistant', responseText);
    } catch (err) {
      console.error(err);
      removeChatMessage(typingId);
      appendChatMessage('assistant', 'ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
    }
  }

  // Helper functions for chat UI
  function appendChatMessage(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    
    // Basic Markdown conversion for bold and lists
    let formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      .replace(/- (.*?)(<br>|$)/g, '• $1$2');

    bubble.innerHTML = formattedText;
    
    const id = 'msg_' + Date.now();
    bubble.id = id;
    
    chatMessagesContainer.appendChild(bubble);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    return id;
  }

  function removeChatMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function getChatHistoryForAPI() {
    const bubbles = chatMessagesContainer.querySelectorAll('.chat-bubble');
    const history = [];
    
    // We only take the last 10 messages to avoid over-cluttering context
    const startIdx = Math.max(1, bubbles.length - 10); // Skip first default system welcome message
    for (let i = startIdx; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      const role = bubble.classList.contains('user') ? 'user' : 'model';
      // Re-convert <br> and bold tags back to plain text for API
      const text = bubble.innerHTML
        .replace(/<br>/g, '\n')
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
        .replace(/<em>(.*?)<\/em>/g, '*$1*')
        .replace(/• /g, '- ');
        
      history.push({
        role: role,
        parts: [{ text: text }]
      });
    }
    return history;
  }
});
