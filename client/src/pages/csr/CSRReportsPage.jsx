import EmptyState from '../../components/EmptyState';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as csr from '../../services/csrService';
import PortfolioSummaryCard from '../../components/PortfolioSummaryCard';
import ReportView from '../../components/ReportView';
import { Page, useLoad, panel } from './CSRLayout';
export default function CSRReportsPage() {
  const {
    data,
    loading,
    error
  } = useLoad(csr.portfolio);
  const [params, setParams] = useSearchParams();
  const id = params.get('project');
  const [report, setReport] = useState(null),
    [reportError, setReportError] = useState(''),
    [reportLoading, setReportLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setReport(null);
    setReportError('');
    if (!id) {
      setReportLoading(false);
      return;
    }
    setReportLoading(true);
    csr.report(id).then(r => {
      if (active) setReport(r.data.report);
    }).catch(e => {
      if (active) setReportError(e.response?.data?.message || 'Could not load report.');
    }).finally(() => {
      if (active) setReportLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);
  return <Page title="CSR reports" error={error || reportError} loading={loading}>{data && <><PortfolioSummaryCard summary={data.summary} /><section className={panel}><h2 className="text-xl font-bold">Project reports</h2>{data.summary.projects.map(p => <div key={p._id} className="flex flex-wrap justify-between gap-3 border-b pb-3"><span>{p.title}</span><button className="text-brand-800 underline" onClick={() => setParams({
            project: p._id
          })}>View report</button></div>)}{!data.summary.projects.length && <EmptyState title="No current funded projects to report." message="Recorded activity will appear here."/>}<p className="text-sm text-stone-500">Projects by status: {Object.entries(data.summary.projectsByStatus).map(([key, count]) => `${key.replaceAll('_', ' ')}: ${count}`).join(' · ') || 'None'}</p></section></>}{reportLoading && <p>Loading project report...</p>}{report && <ReportView report={report} />}</Page>;
}
