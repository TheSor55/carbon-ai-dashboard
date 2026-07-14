// Storage module for saving and retrieving plastic production batches and settings
// Supports chrome.storage.local with a fallback to window.localStorage for local testing

const Storage = {
  // Key names
  KEYS: {
    BATCHES: 'ecoforge_production_batches',
    SETTINGS: 'ecoforge_settings'
  },

  /**
   * Checks if chrome.storage is available
   */
  isChromeStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  /**
   * Retrieves data for a key
   * @param {string} key 
   * @returns {Promise<any>}
   */
  get(key) {
    return new Promise((resolve) => {
      if (this.isChromeStorageAvailable()) {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] || null);
        });
      } else {
        const value = localStorage.getItem(key);
        try {
          resolve(value ? JSON.parse(value) : null);
        } catch (e) {
          resolve(value);
        }
      }
    });
  },

  /**
   * Sets data for a key
   * @param {string} key 
   * @param {any} value 
   * @returns {Promise<void>}
   */
  set(key, value) {
    return new Promise((resolve) => {
      if (this.isChromeStorageAvailable()) {
        chrome.storage.local.set({ [key]: value }, () => {
          resolve();
        });
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        resolve();
      }
    });
  },

  /**
   * Saves a production batch log entry
   * @param {Object} batch 
   * @returns {Promise<Array>} The updated list of batches
   */
  async saveBatch(batch) {
    const batches = await this.get(this.KEYS.BATCHES) || [];
    // Generate unique ID if not present
    if (!batch.id) {
      batch.id = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    // Set timestamp
    if (!batch.timestamp) {
      batch.timestamp = new Date().toISOString();
    }
    batches.push(batch);
    await this.set(this.KEYS.BATCHES, batches);
    return batches;
  },

  /**
   * Deletes a batch log entry by id
   * @param {string} id 
   * @returns {Promise<Array>} The updated list of batches
   */
  async deleteBatch(id) {
    const batches = await this.get(this.KEYS.BATCHES) || [];
    const filtered = batches.filter(b => b.id !== id);
    await this.set(this.KEYS.BATCHES, filtered);
    return filtered;
  },

  /**
   * Retrieves all production batch logs
   * @returns {Promise<Array>}
   */
  async getBatches() {
    return await this.get(this.KEYS.BATCHES) || [];
  },

  /**
   * Saves app settings (e.g., API Key, carbon factors customization)
   * @param {Object} settings 
   */
  async saveSettings(settings) {
    const current = await this.get(this.KEYS.SETTINGS) || {};
    const updated = { ...current, ...settings };
    await this.set(this.KEYS.SETTINGS, updated);
    return updated;
  },

  /**
   * Retrieves settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    const defaultSettings = {
      geminiApiKey: '',
      customCarbonFactors: {}
    };
    const settings = await this.get(this.KEYS.SETTINGS);
    return { ...defaultSettings, ...settings };
  },

  /**
   * Seeds demo data if storage is empty, for display purposes
   */
  async seedDemoDataIfEmpty() {
    const batches = await this.getBatches();
    if (batches.length > 0) return;

    const now = new Date();
    const demoBatches = [
      // Batch 1: Injection Molding PP with hydraulic machine (Inefficient - Hotspot)
      {
        id: 'batch_demo_1',
        timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
        processType: 'injection',
        materialType: 'PP',
        totalMaterialWeight: 1200,
        recycledContentPercentage: 0,
        machineType: 'hydraulic',
        electricityConsumed: 1800, // 1.5 kWh/kg
        scrapPercentage: 12, // High scrap (Hotspot)
        batchName: 'ล็อตฉีดฝาขวด PP #01',
        calculations: {
          rawMaterialFootprint: 2220, // 1200 * 1.85
          processingFootprint: 900, // 1800 * 0.5
          totalFootprint: 3120,
          finishedWeight: 1056, // 1200 * 0.88
          scrapWeight: 144,
          scrapCarbonLoss: 266.4,
          carbonIntensity: 2.95, // 3120 / 1056
          sec: 1.5,
          benchmarkSec: 1.2,
          materialContribution: 71.15,
          energyContribution: 28.85,
          hotspots: [
            {
              category: 'Material',
              severity: 'medium',
              title: 'วัตถุดิบหลักมีการปล่อยคาร์บอนสูง (Raw Material Dominance)',
              percentage: 71.15,
              description: 'คาร์บอนฟุตพริ้นท์ส่วนใหญ่ (71.1%) เกิดจากเม็ดพลาสติกบริสุทธิ์ (Virgin Resin)',
              recommendation: 'แนะนำเพิ่มสัดส่วนพลาสติกรีไซเคิล (Recycled Content) หรือใช้วัสดุ Bio-based เช่น PLA เพื่อลดจุด Hotspot นี้'
            },
            {
              category: 'Machine Efficiency',
              severity: 'medium',
              title: 'เครื่องจักรใช้พลังงานเกินมาตรฐาน (Energy Inefficiency - SEC High)',
              percentage: 1.5,
              description: 'ค่า SEC อยู่ที่ 1.50 kWh/kg สูงกว่าเกณฑ์มาตรฐาน (1.20 kWh/kg) ราว 25%',
              recommendation: 'แนะนำตรวจสอบการหุ้มฉนวนกระบอกทำความร้อน (Heater Band Insulation), รอบการผลิต (Cycle Time) หรือเช็คระบบทำความเย็น (Chiller)'
            },
            {
              category: 'Waste',
              severity: 'medium',
              title: 'อัตราการเกิดเศษของเสียสูง (High Scrap Rate)',
              percentage: 12,
              description: 'มีเศษพลาสติกเสียระหว่างกระบวนการผลิต 12% คิดเป็นคาร์บอนสูญเปล่า 266.4 kg CO2e',
              recommendation: 'แนะนำการปรับปรุงแม่พิมพ์ (Mold Calibration), ตรวจสอบพารามิเตอร์การรีด/ฉีด หรือนำเศษบด (Regrind) กลับมาหลอมผสมใช้ใหม่'
            }
          ]
        }
      },
      // Batch 2: Extrusion PE Pipe (Large volume, relatively efficient)
      {
        id: 'batch_demo_2',
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        processType: 'extrusion',
        materialType: 'HDPE',
        totalMaterialWeight: 5000,
        recycledContentPercentage: 30, // 30% Recycled
        machineType: 'standard',
        electricityConsumed: 2200, // 0.44 kWh/kg
        scrapPercentage: 2,
        batchName: 'ล็อตผลิตท่อ HDPE 2 นิ้ว',
        calculations: {
          rawMaterialFootprint: 7425, // 5000 * (0.7*1.95 + 0.3*0.4) = 5000 * (1.365 + 0.12) = 5000 * 1.485 = 7425
          processingFootprint: 1100, // 2200 * 0.5
          totalFootprint: 8525,
          finishedWeight: 4900,
          scrapWeight: 100,
          scrapCarbonLoss: 148.5,
          carbonIntensity: 1.74,
          sec: 0.44,
          benchmarkSec: 0.5,
          materialContribution: 87.1,
          energyContribution: 12.9,
          hotspots: [
            {
              category: 'Material',
              severity: 'high',
              title: 'วัตถุดิบหลักมีการปล่อยคาร์บอนสูง (Raw Material Dominance)',
              percentage: 87.1,
              description: 'คาร์บอนฟุตพริ้นท์ส่วนใหญ่ (87.1%) เกิดจากเม็ดพลาสติกบริสุทธิ์ (Virgin Resin)',
              recommendation: 'แนะนำเพิ่มสัดส่วนพลาสติกรีไซเคิล (Recycled Content) หรือใช้วัสดุ Bio-based เช่น PLA เพื่อลดจุด Hotspot นี้'
            }
          ]
        }
      },
      // Batch 3: Recycling Process PP (Our recycling facility - Hotspot in washing water)
      {
        id: 'batch_demo_3',
        timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        processType: 'recycling',
        inputScrapWeight: 3000,
        outputPelletsWeight: 2600, // Yield 86.6%
        shredderEnergy: 150,
        washerEnergy: 300,
        dryerEnergy: 550,
        pelletizerEnergy: 1200, // 2200 kWh total
        waterConsumed: 48000, // 48,000 Liters (Water intensity = 18.4 L/kg) - HOTSPOT
        batchName: 'ล็อตแปรรูปเม็ด rPP #08',
        calculations: {
          totalElectricity: 2200,
          electricityEmissions: 1100,
          waterEmissions: 14.4, // 48000 * 0.0003
          totalFootprint: 1114.4,
          yieldPercentage: 86.67,
          materialLossWeight: 400,
          carbonIntensity: 0.43, // 1114.4 / 2600 (very low carbon per kg!)
          sec: 0.85,
          waterIntensity: 18.46,
          subprocesses: {
            shredderPct: 6.8,
            washingDryingPct: 38.6,
            pelletizerPct: 54.5,
            waterContributionPct: 1.3
          },
          hotspots: [
            {
              category: 'Water Intensity',
              severity: 'high',
              title: 'ปริมาณการใช้น้ำล้างพลาสติกสูงเกินไป (High Water Footprint)',
              percentage: 18.46,
              description: 'การผลิตเม็ดรีไซเคิลใช้น้ำเฉลี่ย 18.5 ลิตรต่อกิโลกรัม สูงเกินเกณฑ์แนะนำ',
              recommendation: 'แนะนำติดตั้งระบบน้ำหมุนเวียน (Closed-loop Water Treatment & Recycling System) เพื่อลดการระบายน้ำเสียและประหยัดน้ำดิบ'
            },
            {
              category: 'Washing/Drying Energy',
              severity: 'medium',
              title: 'ขั้นตอนการอบแห้งและล้างใช้พลังงานไฟฟ้าสูง',
              percentage: 38.6,
              description: 'การปั่นหมาดและเครื่องเป่าลมร้อนใช้ไฟฟ้า 38.6% ของทั้งหมด',
              recommendation: 'แนะนำเช็คพัดลมระบายลมร้อนย้อนกลับ (Heat Recovery) หรือทำความสะอาดไส้กรองเครื่องปั่นแห้งอย่างสม่ำเสมอ'
            }
          ]
        }
      }
    ];

    await this.set(this.KEYS.BATCHES, demoBatches);
  }
};

// Export for browser modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
} else {
  window.storage = Storage;
}
