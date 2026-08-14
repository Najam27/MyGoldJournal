import React, { useMemo, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const categories = ["Trading rule", "Level", "Execution type", "Mistake", "Confirmation"];

export function OptionListManager() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(categories[0]);
  const [value, setValue] = useState("");
  const list = trpc.optionLists.list.useQuery(undefined, { enabled: isAuthenticated });
  const add = trpc.optionLists.add.useMutation();
  const setActive = trpc.optionLists.setActive.useMutation();
  const utils = trpc.useUtils();
  const groups = useMemo(() => (list.data ?? []).reduce((result: Record<string, any[]>, item: any) => { (result[item.category] ||= []).push(item); return result; }, {}), [list.data]);
  if (!isAuthenticated) return null;
  const create = async () => { const trimmed = value.trim(); if (!trimmed) return; const previous = utils.optionLists.list.getData(); const temporary = { id: `pending-${Date.now()}`, category, value: trimmed, active: true }; utils.optionLists.list.setData(undefined, current => [...(current ?? []), temporary] as any); setValue(""); try { await add.mutateAsync({ category, value: trimmed }); toast.success("Journal option saved."); } catch (error: any) { utils.optionLists.list.setData(undefined, previous); toast.error(error.message || "Option could not be saved."); } finally { await utils.optionLists.list.invalidate(); } };
  const toggle = async (optionId: number, active: boolean) => { const previous = utils.optionLists.list.getData(); utils.optionLists.list.setData(undefined, current => (current ?? []).map((item: any) => item.id === optionId ? { ...item, active } : item) as any); try { await setActive.mutateAsync({ optionId, active }); } catch (error: any) { utils.optionLists.list.setData(undefined, previous); toast.error(error.message || "Option could not be updated."); } finally { await utils.optionLists.list.invalidate(); } };
  return <><button className="options-fab" onClick={() => setOpen(true)} title="Configure journal lists"><ListChecks size={15} /><span>Rules & lists</span></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="option-manager-dialog"><DialogHeader><DialogTitle>Rules & dropdown lists</DialogTitle><DialogDescription>Create reusable trading rules and values for your journal. Toggle an item off to preserve its history without showing it in future selections.</DialogDescription></DialogHeader><div className="option-create"><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select><Input value={value} maxLength={160} placeholder="Add a rule or option" onChange={event => setValue(event.target.value)} /><Button disabled={add.isPending || !value.trim()} onClick={create}><Plus size={15} /> {add.isPending ? "Saving…" : "Add"}</Button></div><div className="option-groups">{Object.keys(groups).length ? Object.entries(groups).map(([group, items]) => <section key={group}><span>{group}</span><div>{(items as any[]).map(item => <label key={item.id} className={item.active ? "active" : "inactive"}><input type="checkbox" checked={item.active} disabled={setActive.isPending} onChange={event => void toggle(item.id, event.target.checked)} />{item.value}</label>)}</div></section>) : <p className="muted">No custom values yet. Add a trading rule, setup level, or execution label above.</p>}</div></DialogContent></Dialog></>;
}
