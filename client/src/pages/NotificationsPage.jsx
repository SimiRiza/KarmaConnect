import EmptyState from '../components/EmptyState';
import RequestError from '../components/RequestError';
import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import NotificationItem, { notificationsChanged } from '../components/NotificationItem';
export default function NotificationsPage(){
 const [filter,setFilter]=useState(''),[page,setPage]=useState(1),[data,setData]=useState(null),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const r=await api.get('/notifications',{params:{page,limit:20,...(filter?{isRead:filter}:{})}});setData(r.data);setError('');}catch(e){setError(e.response?.data?.message||'Could not load notifications.');}},[page,filter]);
 useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer);},[load]);
 return <div className="max-w-3xl mx-auto px-4 py-10 space-y-5"><h1 className="text-3xl font-bold">Notifications</h1><div className="flex justify-between gap-3"><label>Show <select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}} className="border rounded-lg p-2"><option value="">All</option><option value="false">Unread</option><option value="true">Read</option></select></label><button className="text-brand-800" onClick={async()=>{try{await api.patch('/notifications/mark-all-read');notificationsChanged();await load();}catch{setError('Could not mark notifications read.');}}}>Mark all as read</button></div>{error&&<RequestError message={error} onRetry={load}/>}{!data&&!error&&<p>Loading notifications...</p>}{data&&<><ul className="rounded-xl border overflow-hidden">{data.items.map(item=><NotificationItem key={item._id} item={item} onChange={load}/>)}</ul>{!error&&!data.items.length&&<EmptyState title="No notifications in this view." message="Recorded activity will appear here." />}<div className="flex justify-between"><button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="disabled:opacity-40">Previous</button><span>Page {page} of {Math.max(1,data.totalPages)}</span><button disabled={page>=data.totalPages} onClick={()=>setPage(p=>p+1)} className="disabled:opacity-40">Next</button></div></>}</div>;
}
