import React, { useState } from 'react';

export default function ActionToolkit({ analysisId, report, onOpenEvidence }) {
  const [docType, setDocType] = useState('ward_committee');
  const [citizenName, setCitizenName] = useState('');
  const [citizenPhone, setCitizenPhone] = useState('');
  const [citizenAddress, setCitizenAddress] = useState('');
  const [wardNumber, setWardNumber] = useState(report?.location?.match(/\d+/)?.[0] || '150');
  const [copied, setCopied] = useState(false);

  const location = report?.location || 'Ward 150, Bellandur';
  const projectTitle = report?.project_title || 'Municipal Corporation Civic Directives';
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const getEvidenceId = (keyword) => {
    if (!report?.policies) return null;
    const pol = report.policies.find(p => p.name.toLowerCase().includes(keyword.toLowerCase()));
    return pol?.evidence?.section_id || report.policies[0]?.evidence?.section_id;
  };

  const wardSecId = getEvidenceId('ward') || 's_kmc_13h';
  const taxSecId = getEvidenceId('tax') || 's_kmc_108a';
  const wasteSecId = getEvidenceId('waste') || 's_kmc_431a';
  const rwhSecId = getEvidenceId('rainwater') || 's_kmc_295a';

  const generateLetterText = () => {
    const sender = citizenName.trim() || '[Citizen Name]';
    const phone = citizenPhone.trim() || '[Phone / Contact Number]';
    const addr = citizenAddress.trim() || `[Resident Address, ${location}]`;

    if (docType === 'ward_committee') {
      const impactLines = (report?.impacts || []).slice(0, 3).map((imp, i) => 
        `   (${i + 1}) ${imp.statement} [Confidence: ${imp.confidence || 'High'}]`
      ).join('\n');

      return `FORMAL SUBMISSION: CITIZEN AGENDA ITEM FOR WARD COMMITTEE MEETING
Under Section 13H and Section 13I of the Karnataka Municipal Corporations Act, 1976
Date: ${today}

To:
The Chairperson / Nodal Officer, Ward Committee
Ward No. ${wardNumber} (${location}), Bruhat Bengaluru Mahanagara Palike (BBMP)
Bengaluru, Karnataka

From:
${sender}
${addr}
Contact: ${phone}

SUBJECT: Request to include citizen concern regarding "${projectTitle}" in the upcoming monthly Ward Committee Agenda

Respected Chairperson / Members of the Ward Committee,

I am a resident and voter in Ward No. ${wardNumber} (${location}). Under Section 13H(2) and Section 13I of the Karnataka Municipal Corporations Act, 1976, the Ward Committee is mandated to oversee municipal works, public sanitation, and local infrastructure priorities with participatory civic oversight.

I formally place the following municipal matter before the Ward Committee for deliberation at the next scheduled monthly meeting:

1. SUMMARY OF ISSUE:
   Document Ref: ${projectTitle}
   Affected Locality: ${location}
   Core Civic Concern: ${report?.what_is_happening || 'Implementation of municipal statutory directives'}

2. KEY IMPACTS ON RESIDENTS:
${impactLines || '   (1) Civic regulations require transparent local enforcement and RWA consultation.'}

3. SPECIFIC RESOLUTIONS REQUESTED FROM WARD COMMITTEE:
   a) Conduct an open discussion during the next Area Sabha / Ward Committee meeting under Section 13H.
   b) Request the Ward Junior Health Inspector and Executive Engineer to table an inspection report.
   c) Direct that copy of all vendor work orders and compliance notices be made available for public review.

I request you to confirm receipt and communicate the date and venue of the next Ward Committee meeting.

Yours sincerely,

___________________________
${sender}
Date: ${today}
Enclosure: CivicLens AI Verified Citizen Impact Report`;
    }

    if (docType === 'objection') {
      const questionLines = (report?.suggested_questions || []).map((q, i) => 
        `   (${i + 1}) ${q}`
      ).join('\n');

      return `FORMAL PUBLIC OBJECTION & CITIZEN REPRESENTATION
Under Sections 108A, 295A, and 431-A of the Karnataka Municipal Corporations Act, 1976
Date: ${today}

To:
The Joint Commissioner (Revenue / Health & SWM)
Bruhat Bengaluru Mahanagara Palike (BBMP), Mahadevapura / East Zone
Bengaluru, Karnataka

From:
${sender}
${addr}
Contact: ${phone}

SUBJECT: Objection and Citizen Representation regarding implementation of ${projectTitle} in ${location}

Respected Sir / Madam,

I am submitting this formal representation in response to the public directives outlined in "${projectTitle}". As an affected resident and taxpayer of ${location}, I submit the following objections and requests for clarification:

1. STATUTORY JURISDICTION:
   This objection is lodged pursuant to provisions of the Karnataka Municipal Corporations Act, 1976, specifically regarding equitable civic infrastructure, fair tax assessments, and transparent municipal regulations.

2. GROUNDS OF OBJECTION & QUERIES:
${questionLines || '   (1) Please provide statutory notification timeline before imposing penalties.\n   (2) Provide localized rebate procedures for residential properties.'}

3. MITIGATION PROPOSALS:
   - Provide adequate public notice (minimum 30 days) before strict enforcement or punitive penalties are levied under municipal bye-laws.
   - Mandate localized consultative meetings with local Resident Welfare Associations (RWAs) and apartment associations.
   - Establish dedicated citizen helpdesks at the Ward Office to assist vulnerable property owners and senior citizens.

Kindly acknowledge receipt of this representation and provide a reasoned speaking order.

Yours faithfully,

___________________________
${sender}
Date: ${today}`;
    }

    // RTI Template
    return `APPLICATION FOR INFORMATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005
Date: ${today}

To:
The Public Information Officer (PIO) / Assistant Executive Engineer
Bruhat Bengaluru Mahanagara Palike (BBMP), Ward No. ${wardNumber} (${location})
Bengaluru, Karnataka

1. FULL NAME OF APPLICANT: ${sender}
2. RESIDENTIAL ADDRESS: ${addr}
3. CONTACT NUMBER / EMAIL: ${phone}

4. PARTICULARS OF INFORMATION SOUGHT:
   Subject Matter: Implementation details and expenditure regarding "${projectTitle}" in ${location}.

   The applicant seeks certified copies and official records on the following queries:
   (a) Certified copies of all sanction orders, resolutions, and administrative approvals related to ${projectTitle} passed by the Corporation.
   (b) Certified statement of funds allocated, released, and spent under the relevant Ward Development Fund budget head for Ward No. ${wardNumber} for the current and preceding financial year.
   (c) Certified list of registered waste collection contractors or inspection authorities designated under Section 431-A for ${location}.
   (d) Details of any public consultations, survey reports, or environment impact studies conducted prior to issuing directives for ${location}.
   (e) The name, designation, and office address of the Appellate Authority under Section 19(1) of the RTI Act, 2005.

5. APPLICATION FEE:
   I have paid the statutory fee of Rs. 10/- via Indian Postal Order (IPO) / Court Fee Stamp / BBMP Cash Counter Receipt No. __________________ dated ${today}.

6. BPL STATUS:
   The applicant is not below poverty line (if yes, attach BPL card proof).

Yours sincerely,

___________________________
${sender}
Applicant`;
  };

  const letterText = generateLetterText();

  const handleCopy = () => {
    navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([letterText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CivicLens_${docType}_Ward_${wardNumber}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>CivicLens AI - Official Action Document</title>
          <style>
            body { font-family: "Georgia", serif; line-height: 1.6; padding: 40px; color: #111; }
            pre { white-space: pre-wrap; font-family: inherit; font-size: 13pt; }
          </style>
        </head>
        <body>
          <pre>${letterText}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="card" style={{ padding: '28px 32px', marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
              Citizen Action Toolkit &amp; Official Letter Generator
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
            Generate legally-structured petitions, objections, and RTI queries citing the Karnataka Municipal Corporations Act.
          </p>
        </div>

        {/* Relevant Statutory Evidence Badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {onOpenEvidence && (
            <>
              <button
                onClick={() => onOpenEvidence(analysisId || report?.analysis_id, wardSecId, 'Section 13H/13I', 'Ward Committees')}
                className="btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                📜 Sec 13H (Ward Agenda)
              </button>
              <button
                onClick={() => onOpenEvidence(analysisId || report?.analysis_id, wasteSecId, 'Section 431-A', 'Waste & Sanitation')}
                className="btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                📜 Sec 431-A (Waste Bye-laws)
              </button>
              <button
                onClick={() => onOpenEvidence(analysisId || report?.analysis_id, taxSecId, 'Section 108A', 'Property Tax')}
                className="btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                📜 Sec 108A (Tax Grievance)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action Type Selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setDocType('ward_committee')}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: docType === 'ward_committee' ? '2px solid var(--accent)' : '1px solid var(--border)',
            backgroundColor: docType === 'ward_committee' ? 'var(--accent-light)' : '#ffffff',
            color: docType === 'ward_committee' ? 'var(--primary)' : 'var(--text-main)',
            fontWeight: docType === 'ward_committee' ? 700 : 500,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: 14 }}>🏛️ Ward Committee Agenda</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Section 13H / 13I Petition for Monthly Ward Meeting
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDocType('objection')}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: docType === 'objection' ? '2px solid var(--accent)' : '1px solid var(--border)',
            backgroundColor: docType === 'objection' ? 'var(--accent-light)' : '#ffffff',
            color: docType === 'objection' ? 'var(--primary)' : 'var(--text-main)',
            fontWeight: docType === 'objection' ? 700 : 500,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: 14 }}>⚠️ Formal Objection &amp; Grievance</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Section 108A &amp; 431-A Representation to Joint Commissioner
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDocType('rti')}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: docType === 'rti' ? '2px solid var(--accent)' : '1px solid var(--border)',
            backgroundColor: docType === 'rti' ? 'var(--accent-light)' : '#ffffff',
            color: docType === 'rti' ? 'var(--primary)' : 'var(--text-main)',
            fontWeight: docType === 'rti' ? 700 : 500,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: 14 }}>📑 RTI Information Application</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Section 6(1) of RTI Act 2005 for Tenders &amp; Expenditure
          </div>
        </button>
      </div>

      {/* Citizen Personalization Inputs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 20,
        backgroundColor: '#f8fafc',
        padding: '16px 18px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)'
      }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Your Full Name
          </label>
          <input
            type="text"
            placeholder="e.g. Ramesh Kumar"
            value={citizenName}
            onChange={(e) => setCitizenName(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Phone / Email
          </label>
          <input
            type="text"
            placeholder="e.g. 9845012345 / citizen@gmail.com"
            value={citizenPhone}
            onChange={(e) => setCitizenPhone(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Ward No. / Sub-division
          </label>
          <input
            type="text"
            placeholder="e.g. 150 Bellandur"
            value={wardNumber}
            onChange={(e) => setWardNumber(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Residential Address
          </label>
          <input
            type="text"
            placeholder="e.g. Flat 302, Greenwoods, Bellandur"
            value={citizenAddress}
            onChange={(e) => setCitizenAddress(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </div>
      </div>

      {/* Generated Document Preview */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          backgroundColor: '#1e293b',
          borderTopLeftRadius: 'var(--radius-md)',
          borderTopRightRadius: 'var(--radius-md)',
          color: '#f8fafc',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
            OFFICIAL DRAFT PREVIEW • READY TO FILE
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary btn-sm"
              style={{ backgroundColor: copied ? '#059669' : '#334155', color: '#ffffff', border: 'none' }}
            >
              {copied ? '✓ Copied to Clipboard!' : '📋 Copy Text'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="btn-secondary btn-sm"
              style={{ backgroundColor: '#334155', color: '#ffffff', border: 'none' }}
            >
              💾 Save .txt
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary btn-sm"
            >
              🖨️ Print Form
            </button>
          </div>
        </div>

        <pre style={{
          margin: 0,
          padding: '20px 24px',
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderBottomLeftRadius: 'var(--radius-md)',
          borderBottomRightRadius: 'var(--radius-md)',
          fontSize: 13,
          lineHeight: 1.6,
          color: '#1e293b',
          fontFamily: 'var(--font-mono, monospace)',
          whiteSpace: 'pre-wrap',
          maxHeight: 380,
          overflowY: 'auto'
        }}>
          {letterText}
        </pre>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>💡</span>
        <span>
          Tip: You can submit the Ward Committee form directly at the local BBMP AEE Office or hand it over to your Ward Secretary before the 1st Saturday of each month.
        </span>
      </div>
    </div>
  );
}
