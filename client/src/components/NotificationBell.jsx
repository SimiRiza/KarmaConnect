import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import NotificationItem, { notificationsChanged } from './NotificationItem';
export default function NotificationBell() {
 const [count,setCount]=useState(0),[items,setItems]=useState([]),[open,setOpen]=useState(false),[error,setError]=useState('');
 const container=useRef(null),button=useRef(null);
 const recent=async()=>{try{const r=await api.get('/notifications?limit=5');setItems(r.data.items);setError('');}catch{setError('Could not load notifications.');}};
 useEffect(()=>{
  let active=true,busy=false; const refresh=async()=>{if(busy)return;busy=true;try{const r=await api.get('/notifications/unread-count');if(active){setCount(r.data.count);window.dispatchEvent(new Event('trust-refresh'));}}catch{}finally{busy=false;}};
  refresh();const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('notifications-changed',refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('notifications-changed',refresh);};
 },[]);
 useEffect(()=>{if(!open)return;recent();const close=e=>{if(e.type==='keydown'&&e.key==='Escape'){setOpen(false);button.current?.focus();}else if(e.type==='pointerdown'&&!container.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);};},[open]);
 return <div ref={container} className="relative"><button ref={button} type="button" onClick={()=>setOpen(v=>!v)} aria-label={'Notifications, '+count+' unread'} aria-expanded={open} aria-controls="notification-panel" className="relative p-2 rounded-lg text-brand-800 hover:bg-brand-50"><Bell size={22}/>{count>0&&<span className="absolute -top-1 -right-1 rounded-full bg-accent-500 text-white text-xs px-1.5">{count>99?'99+':count}</span>}</button>{open&&<section id="notification-panel" aria-label="Recent notifications" className="fixed right-2 top-16 w-[min(24rem,calc(100vw-1rem))] max-h-[80vh] overflow-auto bg-white border rounded-xl shadow-xl"><div className="p-4 flex justify-between gap-4"><h2 className="font-bold">Notifications</h2><button className="text-sm text-brand-800" onClick={async()=>{try{await api.patch('/notifications/mark-all-read');notificationsChanged();await recent();}catch{setError('Could not mark notifications read.');}}}>Mark all as read</button></div>{error&&<p role="alert" className="p-4 text-red-700">{error}</p>}<ul>{items.map(item=><NotificationItem key={item._id} item={item} onChange={recent} onNavigate={()=>setOpen(false)}/>)}</ul>{!items.length&&!error&&<p className="p-4 text-stone-600">No notifications yet.</p>}<Link className="block p-4 text-brand-800 underline" to="/notifications" onClick={()=>setOpen(false)}>View all notifications</Link></section>}</div>;
}
