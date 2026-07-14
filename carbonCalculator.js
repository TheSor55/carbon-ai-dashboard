// Carbon Footprint Calculator for Plastic Processing and Recycling
// Reference values & standards for Thailand Grid and Plastic Lifecycle Analysis

const CARBON_FACTORS = {
  // Upstream raw material emissions (kg CO2e / kg resin) - Cradle-to-Gate
  materials: {
    PP: 1.85,
    HDPE: 1.95,
    LDPE: 2.05,
    PVC: 2.50,
    PET: 2.20,
    ABS: 3.80,
    PLA: 0.60, // Bio-based (lower carbon)
    Recycled: 0.40 // Average carbon footprint for collecting & processing post-consumer/post-industrial scrap into recycled resin
  },
  
  // Scope 2 Grid Emission Factor (Thailand Greenhouse Gas Management Organization - TGO)
  electricity: 0.50, // kg CO2e / kWh
  
  // Scope 3 Water Footprint Factor
  water: 0.0003 // kg CO2e / Liter (0.3 kg CO2e / m3)
};

// Benchmark Specific Energy Consumption (SEC) in kWh / kg
const SEC_BENCHMARKS = {
  injection: {
    hydraulic: 1.2,
    hybrid: 0.7,
    electric: 0.4
  },
  extrusion: {
    standard: 0.5
  },
  forming: {
    standard: 0.3
  },
  recycling: {
    standard: 0.6
  }
};

/**
 * Calculates carbon footprint for manufacturing processes (Injection, Extrusion, Forming)
 * @param {Object} data
 */
function calculateManufacturing(data) {
  const {
    processType, // 'injection', 'extrusion', 'forming'
    materialType, // 'PP', 'HDPE', 'LDPE', 'PVC', 'PET', 'ABS', 'PLA'
    totalMaterialWeight, // kg
    recycledContentPercentage = 0, // 0 - 100%
    machineType = 'standard', // 'hydraulic', 'hybrid', 'electric', 'standard'
    electricityConsumed, // kWh
    scrapPercentage = 0 // 0 - 100%
  } = data;

  const virginPct = (100 - recycledContentPercentage) / 100;
  const recycledPct = recycledContentPercentage / 100;

  // 1. Material Footprint (Scope 3 Upstream)
  // For thermoforming, input sheet has slightly higher embedded footprint due to previous sheet extrusion
  const materialUnitFactor = CARBON_FACTORS.materials[materialType] || 2.0;
  const sheetProcessAdder = processType === 'forming' ? 0.25 : 0.0; // Add extrusion sheet energy factor
  
  const virginEmissionsPerKg = materialUnitFactor + sheetProcessAdder;
  const recycledEmissionsPerKg = CARBON_FACTORS.materials.Recycled;

  const rawMaterialFootprint = totalMaterialWeight * (
    (virginPct * virginEmissionsPerKg) + 
    (recycledPct * recycledEmissionsPerKg)
  );

  // 2. Processing Footprint (Scope 2 Electricity)
  const processingFootprint = electricityConsumed * CARBON_FACTORS.electricity;

  // 3. Total Footprint
  const totalFootprint = rawMaterialFootprint + processingFootprint;

  // 4. Waste/Scrap impact
  const scrapWeight = totalMaterialWeight * (scrapPercentage / 100);
  const finishedWeight = totalMaterialWeight - scrapWeight;
  
  // Embedded carbon lost in scrap (which could have been finished parts)
  const scrapCarbonLoss = scrapWeight * (virginPct * virginEmissionsPerKg + recycledPct * recycledEmissionsPerKg);

  // 5. Carbon Intensity (kg CO2e per kg of finished parts)
  const carbonIntensity = finishedWeight > 0 ? (totalFootprint / finishedWeight) : 0;

  // 6. Specific Energy Consumption (SEC)
  const sec = totalMaterialWeight > 0 ? (electricityConsumed / totalMaterialWeight) : 0;

  // 7. Hotspot Analysis
  const hotspots = [];
  const materialContribution = totalFootprint > 0 ? (rawMaterialFootprint / totalFootprint) * 100 : 0;
  const energyContribution = totalFootprint > 0 ? (processingFootprint / totalFootprint) * 100 : 0;

  // Check 1: Material vs Energy Dominance
  if (materialContribution > 70) {
    hotspots.push({
      category: 'Material',
      severity: materialContribution > 85 ? 'high' : 'medium',
      title: 'วัตถุดิบหลักมีการปล่อยคาร์บอนสูง (Raw Material Dominance)',
      percentage: materialContribution,
      description: `คาร์บอนฟุตพริ้นท์ส่วนใหญ่ (${materialContribution.toFixed(1)}%) เกิดจากเม็ดพลาสติกบริสุทธิ์ (Virgin Resin)`,
      recommendation: 'แนะนำเพิ่มสัดส่วนพลาสติกรีไซเคิล (Recycled Content) หรือใช้วัสดุ Bio-based เช่น PLA เพื่อลดจุด Hotspot นี้'
    });
  } else if (energyContribution > 50) {
    hotspots.push({
      category: 'Energy',
      severity: energyContribution > 70 ? 'high' : 'medium',
      title: 'กระบวนการผลิตใช้พลังงานสูง (High Process Energy)',
      percentage: energyContribution,
      description: `การใช้ไฟฟ้าในกระบวนการผลิตมีสัดส่วนคาร์บอนสูงถึง ${energyContribution.toFixed(1)}%`,
      recommendation: 'แนะนำตรวจสอบประสิทธิภาพพลังงานของเครื่องจักร หรือพิจารณาเปลี่ยนมาใช้เครื่องจักรระบบ All-Electric'
    });
  }

  // Check 2: Efficiency (SEC) vs Benchmark
  let benchmarkSec = SEC_BENCHMARKS[processType]?.standard || 0.5;
  if (processType === 'injection' && machineType !== 'standard') {
    benchmarkSec = SEC_BENCHMARKS.injection[machineType];
  }
  
  const secDeviation = benchmarkSec > 0 ? ((sec - benchmarkSec) / benchmarkSec) * 100 : 0;
  if (secDeviation > 20) {
    hotspots.push({
      category: 'Machine Efficiency',
      severity: secDeviation > 50 ? 'high' : 'medium',
      title: 'เครื่องจักรใช้พลังงานเกินมาตรฐาน (Energy Inefficiency - SEC High)',
      percentage: sec,
      description: `ค่า SEC อยู่ที่ ${sec.toFixed(2)} kWh/kg สูงกว่าเกณฑ์มาตรฐาน (${benchmarkSec.toFixed(2)} kWh/kg) ราว ${secDeviation.toFixed(0)}%`,
      recommendation: 'แนะนำตรวจสอบการหุ้มฉนวนกระบอกทำความร้อน (Heater Band Insulation), รอบการผลิต (Cycle Time) หรือเช็คระบบทำความเย็น (Chiller)'
    });
  }

  // Check 3: Scrap Loss Hotspot
  if (scrapPercentage > 8) {
    hotspots.push({
      category: 'Waste',
      severity: scrapPercentage > 15 ? 'high' : 'medium',
      title: 'อัตราการเกิดเศษของเสียสูง (High Scrap Rate)',
      percentage: scrapPercentage,
      description: `มีเศษพลาสติกเสียระหว่างกระบวนการผลิต ${scrapPercentage}% คิดเป็นคาร์บอนสูญเปล่า ${scrapCarbonLoss.toFixed(1)} kg CO2e`,
      recommendation: 'แนะนำการปรับปรุงแม่พิมพ์ (Mold Calibration), ตรวจสอบพารามิเตอร์การรีด/ฉีด หรือนำเศษบด (Regrind) กลับมาหลอมผสมใช้ใหม่'
    });
  }

  return {
    rawMaterialFootprint,
    processingFootprint,
    totalFootprint,
    finishedWeight,
    scrapWeight,
    scrapCarbonLoss,
    carbonIntensity,
    sec,
    benchmarkSec,
    materialContribution,
    energyContribution,
    hotspots
  };
}

/**
 * Calculates carbon footprint for recycling & pelletizing processes
 * @param {Object} data
 */
function calculateRecycling(data) {
  const {
    inputScrapWeight, // kg (Scrap feedstock)
    outputPelletsWeight, // kg (Finished recycled pellets)
    shredderEnergy = 0, // kWh
    washerEnergy = 0, // kWh
    dryerEnergy = 0, // kWh
    pelletizerEnergy = 0, // kWh
    waterConsumed = 0 // Liters
  } = data;

  const totalElectricity = shredderEnergy + washerEnergy + dryerEnergy + pelletizerEnergy;

  // 1. Processing Emissions
  const electricityEmissions = totalElectricity * CARBON_FACTORS.electricity;
  const waterEmissions = waterConsumed * CARBON_FACTORS.water;
  const totalFootprint = electricityEmissions + waterEmissions;

  // 2. Yield
  const yieldPercentage = inputScrapWeight > 0 ? (outputPelletsWeight / inputScrapWeight) * 100 : 0;
  const materialLossWeight = inputScrapWeight - outputPelletsWeight;

  // 3. Carbon Intensity of manufactured recycled resin (kg CO2e / kg rResin)
  const carbonIntensity = outputPelletsWeight > 0 ? (totalFootprint / outputPelletsWeight) : 0;

  // 4. SEC (Specific Energy Consumption)
  const sec = outputPelletsWeight > 0 ? (totalElectricity / outputPelletsWeight) : 0;

  // 5. Water Intensity (Liters per kg of pellets)
  const waterIntensity = outputPelletsWeight > 0 ? (waterConsumed / outputPelletsWeight) : 0;

  // 6. Sub-process Hotspot Analysis
  const hotspots = [];
  
  const shredderPct = totalElectricity > 0 ? (shredderEnergy / totalElectricity) * 100 : 0;
  const washingDryingPct = totalElectricity > 0 ? ((washerEnergy + dryerEnergy) / totalElectricity) * 100 : 0;
  const pelletizerPct = totalElectricity > 0 ? (pelletizerEnergy / totalElectricity) * 100 : 0;
  const waterContributionPct = totalFootprint > 0 ? (waterEmissions / totalFootprint) * 100 : 0;

  // Check 1: Pelletizing Extruder Hotspot (Usually the highest)
  if (pelletizerPct > 60) {
    hotspots.push({
      category: 'Pelletizing Extruder',
      severity: pelletizerPct > 75 ? 'high' : 'medium',
      title: 'การหลอมเหลวตัดเม็ดใช้พลังงานสูง (Pelletizer Extrusion Hotspot)',
      percentage: pelletizerPct,
      description: `พลังงานความร้อนและมอเตอร์เกียร์ในขั้นตอนหลอมเม็ดคิดเป็น ${pelletizerPct.toFixed(1)}% ของพลังงานไฟฟ้าทั้งหมด`,
      recommendation: 'แนะนำติดตั้งชุดทำความร้อนประหยัดพลังงาน (Electromagnetic Induction Heaters) หรือเช็คฉนวนความร้อนเพื่อลดการสูญเสียพลังงาน'
    });
  }

  // Check 2: Washing/Drying Energy vs Water footprint
  if (washingDryingPct > 35) {
    hotspots.push({
      category: 'Washing/Drying Energy',
      severity: 'medium',
      title: 'ขั้นตอนการอบแห้งและล้างใช้พลังงานไฟฟ้าสูง',
      percentage: washingDryingPct,
      description: `การปั่นหมาดและเครื่องเป่าลมร้อนใช้ไฟฟ้า ${washingDryingPct.toFixed(1)}% ของทั้งหมด`,
      recommendation: 'แนะนำเช็คพัดลมระบายลมร้อนย้อนกลับ (Heat Recovery) หรือทำความสะอาดไส้กรองเครื่องปั่นแห้งอย่างสม่ำเสมอ'
    });
  }

  // Check 3: Water consumption footprint
  if (waterIntensity > 8) { // Over 8 liters of water per kg of plastic
    hotspots.push({
      category: 'Water Intensity',
      severity: waterIntensity > 15 ? 'high' : 'medium',
      title: 'ปริมาณการใช้น้ำล้างพลาสติกสูงเกินไป (High Water Footprint)',
      percentage: waterIntensity,
      description: `การผลิตเม็ดรีไซเคิลใช้น้ำเฉลี่ย ${waterIntensity.toFixed(1)} ลิตรต่อกิโลกรัม`,
      recommendation: 'แนะนำติดตั้งระบบน้ำหมุนเวียน (Closed-loop Water Treatment & Recycling System) เพื่อลดการระบายน้ำเสียและประหยัดน้ำดิบ'
    });
  }

  // Check 4: Yield Loss Hotspot
  const lossPct = 100 - yieldPercentage;
  if (lossPct > 15) {
    hotspots.push({
      category: 'Yield Loss',
      severity: lossPct > 25 ? 'high' : 'medium',
      title: 'อัตราสูญเสียน้ำหนักวัตถุดิบสูง (High Yield Loss)',
      percentage: lossPct,
      description: `สูญเสียน้ำหนักพลาสติกระหว่างคัดแยกและล้างสูงถึง ${lossPct.toFixed(1)}%`,
      recommendation: 'แนะนำปรับปรุงการคัดแยกเศษพลาสติกปนเปื้อนก่อนเข้ากระบวนการล้าง เพื่อลดอัตราเศษเหลือทิ้ง'
    });
  }

  return {
    totalElectricity,
    electricityEmissions,
    waterEmissions,
    totalFootprint,
    yieldPercentage,
    materialLossWeight,
    carbonIntensity,
    sec,
    waterIntensity,
    subprocesses: {
      shredderPct,
      washingDryingPct,
      pelletizerPct,
      waterContributionPct
    },
    hotspots
  };
}

// Export for browser modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CARBON_FACTORS,
    SEC_BENCHMARKS,
    calculateManufacturing,
    calculateRecycling
  };
} else {
  // Browser global context
  window.carbonCalculator = {
    CARBON_FACTORS,
    SEC_BENCHMARKS,
    calculateManufacturing,
    calculateRecycling
  };
}
