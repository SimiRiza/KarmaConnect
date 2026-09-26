import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
export const notificationsChanged = () => window.dispatchEvent(new Event('notifications-changed'));
function relative(value) { const minutes=Math.max(0,Math.floor((Date.now()-new Date(value))/60000)); return minutes<1?'Just now':minutes<60?minutes+' min ago':minutes<1440?Math.floor(minutes/60)+' hr ago':Math.floor(minutes/1440)+' days ago'; }
export default function NotificationItem({ item, onChange, onNavigate }) {
 const navigate=useNavigate(), {user}=useAuth();
 const [error,setError]=React.useState(''), [busy,setBusy]=React.useState(false);
 const act=async action=>{setBusy(true);setError('');try{await action();notificationsChanged();await onChange?.();}catch(e){setError(e.response?.data?.message||'Could not update notification.');}finally{setBusy(false);}};
 const open=()=>act(async()=>{
  await api.patch('/notifications/'+item._id+'/read',{isRead:true});
  let to;
  if(item.relatedProjectId) {
   const id=item.relatedProjectId;
   if(item.type==='new_team_message') { try { const r=await api.get(user.role==='ngo'?'/ngo/projects/'+id:'/projects/'+id); const p=r.data.project; if(p.teamId) to='/teams/'+(p.teamId._id||p.teamId); } catch {} }
   to ||= user.role==='ngo'?'/ngo/projects/'+id:user.role==='csr_manager'?'/csr/projects/'+id:user.role==='admin'?null:'/projects/'+id;
  } else if(item.type==='report_received'&&user.role==='admin') to='/admin/reports';
  else if(item.type==='verification_status_changed') to=user.role==='ngo'?'/ngo/profile':'/csr/profile';
  if(to){onNavigate?.();navigate(to);}
 });
 return <li className={'p-4 border-b border-canvas-border '+(item.isRead?'bg-white':'bg-brand-50')}>
  <button type="button" disabled={busy} onClick={open} className="w-full text-left"><span className="flex gap-2 items-center font-semibold">{!item.isRead&&<span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread"/>}{item.title||'Update'}</span><span className="block text-sm text-stone-600 break-words mt-1">{item.message}</span><time dateTime={item.createdAt} className="text-xs text-stone-500">{relative(item.createdAt)}</time></button>
  <div className="flex gap-4 mt-2 text-xs text-brand-800"><button type="button" disabled={busy} onClick={()=>act(()=>api.patch('/notifications/'+item._id+'/read',{isRead:!item.isRead}))}>Mark {item.isRead?'unread':'read'}</button><button type="button" disabled={busy} onClick={()=>act(()=>api.delete('/notifications/'+item._id))}>Delete</button></div>{error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}
 </li>;
}
