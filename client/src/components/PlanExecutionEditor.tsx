import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sessions } from "@/lib/gold";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const rules = ["Maximum 3 trades today. Stop after 3.", "Stop trading if daily loss exceeds my limit.", "After a loss, wait 30 minutes before next entry.", "No chasing moves. Missed entry = wait for next setup.", "Only take A or A+ setups today.", "Never move SL against the trade once set.", "No trades 30 minutes before/after high-impact news.", "Take screenshot for every trade. No exceptions."];
const dateInput = (value = new Date()) => { const year = value.getFullYear(); const month = String(value.getMonth() + 1).padStart(2, "0"); const day = String(value.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; };
const defaultRules = () => rules.map((text, index) => ({ id: String(index), text, checked: true }));
const defaultFollowed = () => rules.map((_, index) => ({ id: String(index), yes: false }));

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }

export function PlanExecutionEditor({ account, plans, onSaved }: any) {
  const [planDate, setPlanDate] = useState(dateInput());
  const [bias, setBias] = useState("Neutral");
  const [keyLevels, setKeyLevels] = useState("");
  const [sessionFocus, setSessionFocus] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [plannedRules, setPlannedRules] = useState(defaultRules);
  const [emotionStart, setEmotionStart] = useState("");
  const [emotionEnd, setEmotionEnd] = useState("");
  const [executionScore, setExecutionScore] = useState<number | null>(null);
  const [followedRules, setFollowedRules] = useState(defaultFollowed);
  const [whatWentWell, setWhatWentWell] = useState("");
  const [whatWentWrong, setWhatWentWrong] = useState("");
  const [lessons, setLessons] = useState("");
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const savePlan = trpc.plans.save.useMutation();
  const selectedPlan = plans.find((plan: any) => dateInput(new Date(plan.planDate)) === planDate);

  useEffect(() => {
    setBias(selectedPlan?.preBias || "Neutral");
    setKeyLevels(selectedPlan?.keyLevels || "");
    setSessionFocus(Array.isArray(selectedPlan?.sessionFocus) ? selectedPlan.sessionFocus : []);
    setNotes(selectedPlan?.planNotes || "");
    setPlannedRules(Array.isArray(selectedPlan?.rulesPlanned) && selectedPlan.rulesPlanned.length ? selectedPlan.rulesPlanned : defaultRules());
    setEmotionStart(selectedPlan?.emotionStart || "");
    setEmotionEnd(selectedPlan?.emotionEnd || "");
    setExecutionScore(selectedPlan?.executionScore ?? null);
    setFollowedRules(Array.isArray(selectedPlan?.rulesFollowed) && selectedPlan.rulesFollowed.length ? selectedPlan.rulesFollowed : defaultFollowed());
    setWhatWentWell(selectedPlan?.whatWentWell || "");
    setWhatWentWrong(selectedPlan?.whatWentWrong || "");
    setLessons(selectedPlan?.lessons || "");
    setOverallRating(selectedPlan?.overallRating ?? null);
    setSaveError("");
  }, [planDate, selectedPlan?.id]);

  const toggleSession = (session: string) => setSessionFocus(current => current.includes(session) ? current.filter(item => item !== session) : [...current, session]);
  const togglePlanned = (id: string) => setPlannedRules(current => current.map(rule => rule.id === id ? { ...rule, checked: !rule.checked } : rule));
  const toggleFollowed = (id: string) => setFollowedRules(current => current.map(rule => rule.id === id ? { ...rule, yes: !rule.yes } : rule));
  const save = async () => {
    if (!account) return;
    setSaveError("");
    try {
      await savePlan.mutateAsync({ accountId: account.id, planDate: new Date(`${planDate}T12:00:00`).getTime(), preBias: bias, keyLevels, sessionFocus, planNotes: notes, rulesPlanned: plannedRules, emotionStart: emotionStart.split(",").map(item => item.trim()).filter(Boolean), emotionEnd: emotionEnd.split(",").map(item => item.trim()).filter(Boolean), executionScore, rulesFollowed: followedRules, whatWentWell, whatWentWrong, lessons, overallRating });
      await onSaved();
      toast.success(selectedPlan ? "Plan and execution review updated." : "Plan and execution review saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The plan could not be saved. Your inputs are still here—please try again.";
      setSaveError(message);
      toast.error(message);
    }
  };

  const daysInMonth = new Date(Number(planDate.slice(0, 4)), Number(planDate.slice(5, 7)), 0).getDate();
  return <><section className="section-heading"><div><span className="eyebrow">PROCESS OVER OUTCOME</span><h2>Plan & Execution</h2><p>Write the plan before the session, then complete the review without rewriting history.</p></div><div className="date-control"><Input type="date" value={planDate} onChange={event => setPlanDate(event.target.value)} /><Button variant="outline" onClick={() => setPlanDate(dateInput())}>Today</Button></div></section><div className="plan-layout"><section className="panel mini-calendar"><div className="panel-title"><div><span>MONTH SNAPSHOT</span><h3>{new Date(`${planDate}T12:00:00`).toLocaleString("en-US", { month: "long", year: "numeric" })}</h3></div></div><div className="mini-day-grid">{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const value = `${planDate.slice(0, 8)}${String(day).padStart(2, "0")}`; const recorded = plans.some((plan: any) => dateInput(new Date(plan.planDate)) === value); return <button key={day} className={`${planDate === value ? "selected" : ""} ${recorded ? "recorded" : ""}`} onClick={() => setPlanDate(value)}>{day}</button>; })}</div><p className="plan-calendar-key"><i /> Saved plan / review</p></section><section className="panel plan-editor"><div className="plan-day-head"><div><span className="eyebrow">{selectedPlan ? "SAVED ENTRY" : "NEW ENTRY"}</span><h3>{new Date(`${planDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}</h3></div><Button disabled={!account || savePlan.isPending} onClick={() => void save()}>{savePlan.isPending ? "Saving…" : selectedPlan ? "Update entry" : "Save entry"}</Button></div>{saveError && <p className="plan-save-error" role="alert">{saveError}</p>}<div className="form-section"><span className="section-label">A. PRE-SESSION PLAN</span><Field label="Market bias"><div className="pill-options">{["Bullish", "Bearish", "Neutral", "No clear bias"].map(item => <button key={item} className={bias === item ? "selected" : ""} onClick={() => setBias(item)}>{item}</button>)}</div></Field><Field label="Key levels"><Textarea value={keyLevels} onChange={event => setKeyLevels(event.target.value)} rows={3} placeholder="Asia high/low, London open, HTF zones…" /></Field><Field label="Session focus"><div className="checkbox-cluster">{sessions.map(session => <label key={session}><input type="checkbox" checked={sessionFocus.includes(session)} onChange={() => toggleSession(session)} /> {session}</label>)}</div></Field><Field label="Plan notes"><Textarea value={notes} onChange={event => setNotes(event.target.value)} rows={4} placeholder="Write your game plan before the session begins…" /></Field><div className="rule-list">{plannedRules.map((rule: any, index: number) => <label key={rule.id}><input type="checkbox" checked={rule.checked} onChange={() => togglePlanned(rule.id)} /> <span>{index + 1}. {rule.text}</span></label>)}</div></div><div className="form-section"><span className="section-label">B. END-OF-DAY EXECUTION REVIEW</span><Field label="Emotion at start (comma separated)"><Input value={emotionStart} onChange={event => setEmotionStart(event.target.value)} placeholder="Calm, focused" /></Field><Field label="Emotion at end (comma separated)"><Input value={emotionEnd} onChange={event => setEmotionEnd(event.target.value)} placeholder="Disciplined, tired" /></Field><Field label="Execution score"><div className="pill-options">{[1, 2, 3, 4, 5].map(score => <button key={score} className={executionScore === score ? "selected" : ""} onClick={() => setExecutionScore(score)}>{score}/5</button>)}</div></Field><Field label="Overall day rating"><div className="pill-options">{[1, 2, 3, 4, 5].map(score => <button key={score} className={overallRating === score ? "selected" : ""} onClick={() => setOverallRating(score)}>{score}/5</button>)}</div></Field><div className="rule-list">{plannedRules.map((rule: any, index: number) => { const followed = followedRules.find((item: any) => item.id === rule.id)?.yes ?? false; return <label key={rule.id}><input type="checkbox" checked={followed} onChange={() => toggleFollowed(rule.id)} /> <span>{index + 1}. Followed: {rule.text}</span></label>; })}</div><Field label="What went well"><Textarea value={whatWentWell} onChange={event => setWhatWentWell(event.target.value)} rows={3} placeholder="Execution strengths and discipline wins…" /></Field><Field label="What went wrong"><Textarea value={whatWentWrong} onChange={event => setWhatWentWrong(event.target.value)} rows={3} placeholder="Mistakes, missed rules, or impulsive moments…" /></Field><Field label="Lesson for tomorrow"><Textarea value={lessons} onChange={event => setLessons(event.target.value)} rows={3} placeholder="One specific adjustment for the next session…" /></Field></div></section></div></>;
}
