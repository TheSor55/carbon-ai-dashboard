// AI Service to interface with Google Gemini API for OCR parsing and Eco-Factory Advice

const AIService = {
  /**
   * Helper to make a request to Gemini API
   */
  async callGemini(apiKey, model, contents, jsonMode = false) {
    if (!apiKey) {
      throw new Error('กรุณาตั้งค่า Gemini API Key ในหน้า Settings ก่อนใช้งาน');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: contents,
    };

    if (jsonMode) {
      requestBody.generationConfig = {
        responseMimeType: 'application/json'
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`Gemini API Error: ${errorMessage}`);
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error('ไม่ได้รับการตอบกลับที่เป็นข้อความจาก Gemini API');
      }

      if (jsonMode) {
        try {
          return JSON.parse(textResponse);
        } catch (e) {
          console.error("Failed to parse JSON response from Gemini:", textResponse);
          throw new Error('ผลลัพธ์จาก AI ไม่ใช่รูปแบบ JSON ที่ถูกต้อง');
        }
      }

      return textResponse;
    } catch (error) {
      console.error("Gemini API call failed:", error);
      throw error;
    }
  },

  /**
   * Parses a production sheet report or meter photo using Gemini Vision
   * @param {string} apiKey Gemini API Key
   * @param {string} base64Data Base64 representation of the image
   * @param {string} mimeType File mime type (e.g., image/png, image/jpeg)
   * @returns {Promise<Object>} Extracted batch data
   */
  async parseProductionDocument(apiKey, base64Data, mimeType) {
    const prompt = `คุณคือระบบ AI ผู้เชี่ยวชาญการอ่านเอกสารอุตสาหกรรม หน้าที่ของคุณคือวิเคราะห์รูปภาพรายงานการผลิตพลาสติก หรือรูปถ่ายมิเตอร์ไฟฟ้า/น้ำประปา แล้วสกัดข้อมูลที่เกี่ยวข้องออกมาเป็นรูปแบบ JSON เท่านั้น

กติกาการสกัดข้อมูล:
1. หากพบข้อมูลที่เป็นรายงานการผลิต หรือสรุปล็อต ให้หา:
   - processType: ต้องเป็นอย่างใดอย่างหนึ่งในสี่ค่านี้เท่านั้น: "injection" (การฉีด), "extrusion" (การรีด), "forming" (การขึ้นรูป), "recycling" (การรีไซเคิลหลอมเม็ด)
   - materialType: ประเภทพลาสติกหลัก เช่น "PP", "HDPE", "LDPE", "PVC", "PET", "ABS", "PLA" (หากหาไม่พบให้เลือกค่าที่เหมาะสมที่สุดหรือเว้นว่าง)
   - totalMaterialWeight: น้ำหนักวัตถุดิบทั้งหมด (หน่วยกิโลกรัม kg) เป็นตัวเลขจำนวนจริง
   - recycledContentPercentage: อחוזสัดส่วนเม็ดพลาสติกรีไซเคิลที่ป้อนเข้า (0 - 100) เป็นตัวเลข
   - electricityConsumed: ปริมาณไฟฟ้าที่ใช้ในกระบวนการผลิต (หน่วย kWh) เป็นตัวเลข
   - scrapPercentage: อัตราร้อยละเศษเสียจากการผลิต (0 - 100) เป็นตัวเลข
   - waterConsumed: ปริมาณน้ำที่ใช้ (สำหรับกระบวนการล้าง/รีไซเคิล) ในหน่วย ลิตร (L) เป็นตัวเลข (หากเจอเป็น ลูกบาศก์เมตร (m3) ให้คูณ 1000 เพื่อแปลงเป็นลิตร)
   - batchName: ชื่อล็อตการผลิต หรือเลขที่เอกสาร หรือวันที่บันทึก (ระบุมาเป็น String สั้นๆ)

2. หากพบเป็นรูปถ่ายมิเตอร์ไฟฟ้าอย่างเดียว:
   - สกัดตัวเลขมิเตอร์ไฟฟ้า (kWh) ใส่ในฟิลด์ electricityConsumed และให้คาดเดาความน่าจะเป็นของกระบวนการแล้วกำหนดชื่อ batchName เป็น "Meter Reading - [ตัวเลขอ่านได้]"

ส่งคำตอบกลับมาเฉพาะ JSON โครงสร้างนี้เท่านั้น ห้ามมีคำอธิบายเพิ่มเติมใดๆ นอกเหนือจาก JSON:
{
  "success": true,
  "processType": "injection|extrusion|forming|recycling",
  "materialType": "PP|HDPE|LDPE|PVC|PET|ABS|PLA",
  "totalMaterialWeight": 0.0,
  "recycledContentPercentage": 0.0,
  "electricityConsumed": 0.0,
  "scrapPercentage": 0.0,
  "waterConsumed": 0.0,
  "batchName": "string"
}`;

    const contents = [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ];

    // Use Gemini 1.5 Flash as default for OCR tasks (fast and cost-effective)
    return await this.callGemini(apiKey, 'gemini-1.5-flash', contents, true);
  },

  /**
   * Generates expert advice for a specific production batch and its identified hotspots
   * @param {string} apiKey 
   * @param {Object} batchData The batch details and calculation results containing hotspots
   * @returns {Promise<string>} Markdown text with expert analysis and action items
   */
  async getHotspotAdvice(apiKey, batchData) {
    const prompt = `คุณคือ "AI Eco-Factory Advisor" ที่ปรึกษาด้านการผลิตพลาสติกที่เป็นมิตรต่อสิ่งแวดล้อมและการประหยัดพลังงานในระดับอุตสาหกรรม

วิเคราะห์ล็อตการผลิตปัจจุบันดังนี้:
- ชื่อล็อต: ${batchData.batchName || 'ไม่ได้ระบุ'}
- กระบวนการ: ${batchData.processType}
- เม็ดพลาสติก: ${batchData.materialType}
- น้ำหนักรวม: ${batchData.totalMaterialWeight} kg (สัดส่วนรีไซเคิล: ${batchData.recycledContentPercentage}%)
- ค่าไฟฟ้าที่ใช้: ${batchData.electricityConsumed} kWh (Specific Energy Consumption หรือ SEC: ${batchData.calculations?.sec.toFixed(2)} kWh/kg)
- อัตราเศษของเสีย (Scrap Rate): ${batchData.scrapPercentage}%
- ปริมาณการใช้น้ำ (สำหรับงานรีไซเคิล): ${batchData.waterConsumed || 0} ลิตร

จุดวิกฤตคาร์บอน (Hotspots) ที่ระบบตรวจพบ:
${JSON.stringify(batchData.calculations?.hotspots || [], null, 2)}

หน้าที่ของคุณ:
1. อธิบายให้เข้าใจง่ายว่าเพราะเหตุใดจุด Hotspot เหล่านั้นจึงปล่อยคาร์บอนสูง และมีความสำคัญอย่างไรในแง่ของต้นทุนและสิ่งแวดล้อม
2. ให้คำแนะนำเชิงวิศวกรรมอุตสาหกรรม (Industrial Engineering) หรือแนวทางปฏิบัติที่ดีที่สุด (Best Practices) ที่เป็นไปได้จริงเพื่อแก้ไขปัญหานั้นๆ เช่น:
   - สำหรับการฉีดพลาสติก: อธิบายรอบเวลา (Cycle time), อุณหภูมิหน้าเตา, ตัวทำความเย็น (Chiller)
   - สำหรับการหลอมเม็ดรีไซเคิล: แนะนำการคัดแยกเศษ, การปรับตั้งค่าบด/ล้าง, การใช้ระบบน้ำหมุนเวียน (Closed-loop), การหุ้มฉนวนประหยัดพลังงานหัวฉีด (Electromagnetic Induction Heaters)
3. เขียนคำแนะนำเป็นภาษาไทยที่สุภาพ เป็นมืออาชีพ ชัดเจน มีหัวข้อย่อยและเน้นตัวหนาให้เห็นขั้นตอนการปรับปรุงแก้ไขอย่างเด่นชัด โดยใช้สไตล์จัดหน้าแบบ Markdown`;

    const contents = [
      {
        parts: [{ text: prompt }]
      }
    ];

    return await this.callGemini(apiKey, 'gemini-1.5-flash', contents, false);
  },

  /**
   * General chat with AI advisor
   */
  async chatWithAdvisor(apiKey, messageHistory, currentBatchesSummary = "") {
    const systemPrompt = `คุณคือ "AI Eco-Factory Advisor" ผู้เชี่ยวชาญด้านการจัดทำบัญชีคาร์บอนฟุตพริ้นท์และการลดคาร์บอนในกระบวนการแปรรูปพลาสติก (การฉีด, การขึ้นรูป, การรีดแผ่น/ท่อ) และกระบวนการทำเม็ดพลาสติกรีไซเคิล 

ข้อมูลสรุปประวัติล็อตการผลิตในโรงงานปัจจุบัน:
${currentBatchesSummary}

คุณต้องช่วยเหลือผู้ใช้งานที่เป็นผู้จัดการโรงงานหรือพนักงานคุมเครื่องจักรในการ:
1. ตอบคำถามเกี่ยวกับวิธีการคำนวณคาร์บอนฟุตพริ้นท์และมาตรฐาน ISO 14067 (Product Carbon Footprint)
2. แนะนำเทคนิคประหยัดพลังงานในแต่ละส่วน (Heater, Motor, Cooling system, Air leak)
3. อธิบายการจัดการเศษพลาสติกเสีย (Scrap Management) เพื่อไม่ให้สิ้นเปลืองคาร์บอนวัสดุเปล่าประโยชน์
4. ให้ตอบคำถามเป็นภาษาไทยด้วยน้ำเสียงที่เป็นมิตร เป็นวิศวกรผู้เชี่ยวชาญ และแชร์ข้อมูลเชิงสถิติหรือเทคนิคที่เป็นรูปธรรม`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      ...messageHistory
    ];

    return await this.callGemini(apiKey, 'gemini-1.5-flash', contents, false);
  }
};

// Export for browser modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
} else {
  window.aiService = AIService;
}
