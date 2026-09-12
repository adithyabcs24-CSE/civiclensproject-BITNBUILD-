import React, { useState } from 'react';

// BBMP Unit Area Value (UAV) Zonal Rates per sq ft per month (Residential)
const ZONAL_RATES = {
  A: { name: 'Zone A (Prime / CBD / Indiranagar / Koramangala)', self: 2.80, tenanted: 5.60, comm: 12.00 },
  B: { name: 'Zone B (Major Suburbs / Bellandur / HSR / Jayanagar)', self: 2.40, tenanted: 4.80, comm: 10.00 },
  C: { name: 'Zone C (Developing / Whitefield / Marathahalli)', self: 2.00, tenanted: 4.00, comm: 8.50 },
  D: { name: 'Zone D (Outer Areas / Electronic City / Yelahanka)', self: 1.60, tenanted: 3.20, comm: 7.00 },
  E: { name: 'Zone E (Peripheral Corridors)', self: 1.20, tenanted: 2.40, comm: 5.50 },
  F: { name: 'Zone F (Gramathana / Rural Boundaries)', self: 0.80, tenanted: 1.60, comm: 4.00 }
};

export default function CivicCalculators({ analysisId, report, onOpenEvidence }) {
  const [activeTab, setActiveTab] = useState('uav');

  // UAV Calculator State
  const [zone, setZone] = useState('B');
  const [occupancy, setOccupancy] = useState('self'); // self | tenanted | comm
  const [areaSqFt, setAreaSqFt] = useState(1200);
  const [buildingAge, setBuildingAge] = useState('5_to_15'); // 0_to_5 | 5_to_15 | 15_to_25 | over_25

  // RWH Calculator State
  const [plotArea, setPlotArea] = useState(2400);
  const [roofArea, setRoofArea] = useState(1400);
  const [propertyType, setPropertyType] = useState('existing'); // existing | new

  // UAV Calculations
  const zoneRate = ZONAL_RATES[zone] || ZONAL_RATES.B;
  let ratePerSqFt = zoneRate.self;
  if (occupancy === 'tenanted') ratePerSqFt = zoneRate.tenanted;
  if (occupancy === 'comm') ratePerSqFt = zoneRate.comm;

  const grossAnnualValue = (Number(areaSqFt) || 0) * ratePerSqFt * 12;

  let deprRate = 0.15;
  if (buildingAge === '0_to_5') deprRate = 0.05;
  else if (buildingAge === '5_to_15') deprRate = 0.15;
  else if (buildingAge === '15_to_25') deprRate = 0.30;
  else if (buildingAge === 'over_25') deprRate = 0.40;

  const depreciation = grossAnnualValue * deprRate;
  const netAnnualValue = Math.max(0, grossAnnualValue - depreciation);
  const taxRate = occupancy === 'comm' ? 0.25 : 0.20;
  const basePropertyTax = Math.round(netAnnualValue * taxRate);

  // Cesses: 6% Library, 3% Beggary, 2% Urban Transport / Health, plus SWM cess
  const libraryCess = Math.round(basePropertyTax * 0.06);
  const beggaryCess = Math.round(basePropertyTax * 0.03);
  const transportCess = Math.round(basePropertyTax * 0.02);
  const swmCess = areaSqFt > 1000 ? 600 : 360;
  const totalTaxPayable = basePropertyTax + libraryCess + beggaryCess + transportCess + swmCess;
  const earlyRebate = Math.round(basePropertyTax * 0.05);
  const netWithRebate = totalTaxPayable - earlyRebate;

  // RWH Calculations under Section 295A
  const plotNum = Number(plotArea) || 0;
  const roofNum = Number(roofArea) || 0;

  // Sec 295A rule: Mandatory for existing >= 2400 sq ft or new >= 1200 sq ft
  const isMandatory = (propertyType === 'new' && plotNum >= 1200) || (propertyType === 'existing' && plotNum >= 2400);

  // Standard BBMP RWH formula: 60 Liters per sq.m of roof area (1 sq ft = 0.0929 sq m) -> ~5.57 L per sq.ft.
  const roofAreaSqM = roofNum * 0.0929;
  const pavedAreaSqM = Math.max(0, (plotNum - roofNum) * 0.5 * 0.0929);

  const minRainwaterStorageLitres = Math.round(roofAreaSqM * 60);
  const minRechargeVolumeLitres = Math.round(pavedAreaSqM * 30);
  const totalWaterHarvestPotential = minRainwaterStorageLitres + minRechargeVolumeLitres;

  // Sump size in Gallons (1 Litre = 0.264172 Gallons)
  const sumpGallons = Math.round(minRainwaterStorageLitres * 0.264172);

  // Recommended recharge well: 3 ft diameter, 15 ft deep
  const wellDiameterFt = 3;
  const wellDepthFt = plotNum > 4000 ? 20 : 15;

  const getSecId = (keyword) => {
    const pol = report?.policies?.find(p => p.name?.toLowerCase().includes(keyword.toLowerCase()));
    return pol?.evidence?.section_id || 's_kmc_108a';
  };

  return (
    <div className="card" style={{ padding: '28px 32px', marginBottom: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🧮</span>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
              Statutory Civic Calculators &amp; Compliance Checkers
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
            Official formula models anchored directly to Sections 108A and 295A of the Karnataka Municipal Corporations Act.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab('uav')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'uav' ? 'var(--primary)' : '#e2e8f0',
              color: activeTab === 'uav' ? '#ffffff' : 'var(--text-main)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            🏢 Property Tax (Sec 108A)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rwh')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'rwh' ? 'var(--primary)' : '#e2e8f0',
              color: activeTab === 'rwh' ? '#ffffff' : 'var(--text-main)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            💧 Rainwater Harvesting (Sec 295A)
          </button>
        </div>
      </div>

      {/* CALCULATOR 1: UAV PROPERTY TAX */}
      {activeTab === 'uav' && (
        <div>
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ fontSize: 13, color: '#1e40af' }}>
              <strong>Statutory Foundation:</strong> Unit Area Value (UAV) System governed by Section 108A of the Karnataka Municipal Corporations Act, 1976.
            </div>
            {onOpenEvidence && (
              <button
                type="button"
                onClick={() => onOpenEvidence(analysisId || report?.analysis_id, getSecId('tax'), 'Section 108A', 'Property Tax')}
                className="btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 10px', backgroundColor: '#ffffff' }}
              >
                📜 View Sec 108A Text →
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }}>
            {/* Input Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                  Zonal Value Classification
                </label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  {Object.entries(ZONAL_RATES).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                    Occupancy Status
                  </label>
                  <select
                    value={occupancy}
                    onChange={(e) => setOccupancy(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="self">Owner Occupied (Residential)</option>
                    <option value="tenanted">Tenanted (Residential)</option>
                    <option value="comm">Commercial Use</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                    Building Age (Depreciation)
                  </label>
                  <select
                    value={buildingAge}
                    onChange={(e) => setBuildingAge(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="0_to_5">0 to 5 Years (5% Depr)</option>
                    <option value="5_to_15">5 to 15 Years (15% Depr)</option>
                    <option value="15_to_25">15 to 25 Years (30% Depr)</option>
                    <option value="over_25">Above 25 Years (40% Depr)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                  Built-up Area: <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{areaSqFt} sq. ft.</span>
                </label>
                <input
                  type="range"
                  min="200"
                  max="6000"
                  step="50"
                  value={areaSqFt}
                  onChange={(e) => setAreaSqFt(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>200 sq.ft. (1 BHK)</span>
                  <span>1,200 sq.ft. (Standard)</span>
                  <span>6,000 sq.ft. (Villa/Apt)</span>
                </div>
              </div>
            </div>

            {/* Results Display */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Estimated Assessment Breakdown
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>
                  ₹{totalTaxPayable.toLocaleString('en-IN')}{' '}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/ year</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Base UAV Rate:</span>
                    <strong>₹{ratePerSqFt.toFixed(2)} / sq.ft. / mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gross Annual Value (GAV):</span>
                    <strong>₹{Math.round(grossAnnualValue).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                    <span>Depreciation Deduction ({(deprRate * 100).toFixed(0)}%):</span>
                    <strong>- ₹{Math.round(depreciation).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Base Tax ({(taxRate * 100).toFixed(0)}% of NAV):</span>
                    <strong>₹{basePropertyTax.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Statutory Cesses (Library, Beggary, Transport):</span>
                    <strong>₹{(libraryCess + beggaryCess + transportCess).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Solid Waste Management (SWM) Cess (Sec 431-A):</span>
                    <strong>₹{swmCess.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              {/* 5% Early Rebate Banner */}
              <div style={{
                marginTop: 16,
                padding: '10px 14px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#047857' }}>
                    🎉 5% Early Payment Rebate (Sec 108A(3))
                  </div>
                  <div style={{ fontSize: 11, color: '#065f46' }}>
                    Pay before April 30 deadline and save ₹{earlyRebate.toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#047857' }}>
                  ₹{netWithRebate.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 2: RAINWATER HARVESTING COMPLIANCE */}
      {activeTab === 'rwh' && (
        <div>
          <div style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ fontSize: 13, color: '#047857' }}>
              <strong>Statutory Foundation:</strong> Section 295A of Karnataka Municipal Corporations Act (Mandatory Rain Water Harvesting).
            </div>
            {onOpenEvidence && (
              <button
                type="button"
                onClick={() => onOpenEvidence(analysisId || report?.analysis_id, getSecId('rainwater'), 'Section 295A', 'Rainwater Harvesting')}
                className="btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 10px', backgroundColor: '#ffffff' }}
              >
                📜 View Sec 295A Text →
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }}>
            {/* Input Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                  Property Classification
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="propType"
                      checked={propertyType === 'existing'}
                      onChange={() => setPropertyType('existing')}
                      style={{ accentColor: 'var(--teal)' }}
                    />
                    <span>Existing Property (Built prior to 2009)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="propType"
                      checked={propertyType === 'new'}
                      onChange={() => setPropertyType('new')}
                      style={{ accentColor: 'var(--teal)' }}
                    />
                    <span>New Construction</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                  Total Plot / Site Area: <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{plotArea} sq. ft.</span>
                </label>
                <input
                  type="range"
                  min="600"
                  max="10000"
                  step="100"
                  value={plotArea}
                  onChange={(e) => setPlotArea(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--teal)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>600 sq.ft. (Small)</span>
                  <span>1,200 sq.ft. (30x40)</span>
                  <span>2,400 sq.ft. (40x60 threshold)</span>
                  <span>10,000 sq.ft.</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                  Rooftop Catchment Area: <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{roofArea} sq. ft.</span>
                </label>
                <input
                  type="range"
                  min="300"
                  max={plotArea}
                  step="50"
                  value={Math.min(roofArea, plotArea)}
                  onChange={(e) => setRoofArea(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--teal)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>300 sq.ft.</span>
                  <span>Max (Plot Area): {plotArea} sq.ft.</span>
                </div>
              </div>
            </div>

            {/* Compliance Output */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Statutory Mandate Check
                  </span>
                  <span className={isMandatory ? 'badge badge-high' : 'badge badge-medium'}>
                    {isMandatory ? '● MANDATORY UNDER SEC 295A' : '○ Recommended / Voluntary'}
                  </span>
                </div>

                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f766e', marginBottom: 12 }}>
                  {minRainwaterStorageLitres.toLocaleString('en-IN')}{' '}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Litres minimum tank capacity</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Equivalent Gallon Volume:</span>
                    <strong>{sumpGallons.toLocaleString('en-IN')} Gallons</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ground Recharge Volume Required:</span>
                    <strong>{minRechargeVolumeLitres.toLocaleString('en-IN')} Litres</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Recommended Recharge Well:</span>
                    <strong>{wellDiameterFt} ft dia. × {wellDepthFt} ft depth</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Annual Harvest Potential:</span>
                    <strong>~{Math.round(roofNum * 80).toLocaleString('en-IN')} Litres / yr</strong>
                  </div>
                </div>
              </div>

              {/* Penalty Risk Notice */}
              <div style={{
                marginTop: 16,
                padding: '10px 14px',
                backgroundColor: isMandatory ? '#fff1f2' : '#f8fafc',
                border: isMandatory ? '1px solid #fecdd3' : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)'
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isMandatory ? '#be123c' : 'var(--text-main)' }}>
                  {isMandatory ? '⚠️ Non-Compliance Penalty Slab' : 'ℹ️ Compliance Exemption'}
                </div>
                <div style={{ fontSize: 11, color: isMandatory ? '#9f1239' : 'var(--text-muted)', marginTop: 2 }}>
                  {isMandatory 
                    ? 'Properties failing to install RWH face a 25% water supply surcharge for the first 3 months and 50% surcharge thereafter.'
                    : 'Plots under 2,400 sq. ft. (existing) are exempt from punitive surcharges, but recharge wells are strongly encouraged for water security.'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
