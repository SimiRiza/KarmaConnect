import React, { useEffect, useState } from 'react';
import api from '../services/api';
import VerificationBadge from './VerificationBadge';
import EvidenceVerifiedBadge from './EvidenceVerifiedBadge';
import ReportModal from './ReportModal';
export default function ProjectTrust({projectId,compact=false}){
 const [trust,setTrust]=useState(null);
 useEffect(()=>{let active=true;const load=()=>api.get('/projects/'+projectId+'/trust').then(r=>{if(active)setTrust(r.data);}).catch(()=>{});load();window.addEventListener('trust-refresh',load);window.addEventListener('focus',load);return()=>{active=false;window.removeEventListener('trust-refresh',load);window.removeEventListener('focus',load);};},[projectId]);
 if(!trust)return null;
 return <div className="space-y-2 text-sm">{trust.ngo&&<div className="flex flex-wrap gap-2 items-center"><span>{trust.ngo.ngoName}</span><VerificationBadge status={trust.ngo.verificationStatus}/>{!compact&&<ReportModal targetType="ngo" targetId={trust.ngo._id} label="Report NGO"/>}</div>}{!compact&&trust.companies.map(c=><div key={c._id} className="flex flex-wrap gap-2 items-center"><span>{c.companyName}</span><VerificationBadge status={c.verificationStatus} entity="company"/><ReportModal targetType="csr_profile" targetId={c._id} label="Report company"/></div>)}{!compact&&<div className="flex flex-wrap gap-3 items-center">{trust.evidenceVerified&&<EvidenceVerifiedBadge/>}{trust.requiresAuthorityApproval&&!trust.evidenceVerified&&<span className="text-amber-800">Large project: evidence review required</span>}<ReportModal targetType="project" targetId={projectId}/></div>}</div>;
}
