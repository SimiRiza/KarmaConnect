import React from 'react';
import { Link } from 'react-router-dom';
export default function SkillRequestCard({ request }) {
  return <article className="rounded-2xl border border-accent-200 bg-orange-50 p-5 space-y-2"><p className="font-semibold text-orange-800">{request.matchedSkills ? 'They need your exact skill' : 'Skill request'} · {request.status}</p><h3 className="font-bold text-xl">{request.skillNeeded} · {request.hoursNeeded} hours</h3><p className="whitespace-pre-wrap break-words">{request.description}</p>{request.matchedSkills && <p className="text-sm">Your matching skills: {request.matchedSkills.join(', ')}</p>}{request.projectId && <Link className="inline-block text-brand-800 underline font-semibold" to={`/projects/${request.projectId}`}>{request.projectTitle} →</Link>}</article>;
}
