"use client";
import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/utils/api";

interface UserOption {
  id: number;
  name: string;
  department: string;
  email: string | null;
}

interface InternalContact {
  type: "user" | "manual";
  userId?: number;
  name: string;
  department?: string;
}

interface Props {
  selectedContacts: InternalContact[];
  onChange: (contacts: InternalContact[]) => void;
  placeholder?: string;
  error?: string;
}

export type { InternalContact };

export default function InternalContactSelector({ selectedContacts, onChange, placeholder, error }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setManualMode(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchUsers = (q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const users = await apiFetch(`/api/auth/users/search?q=${encodeURIComponent(q)}`);
        const selectedIds = selectedContacts.filter(c => c.type === "user").map(c => c.userId);
        setResults(users.filter((u: UserOption) => !selectedIds.includes(u.id)));
      } catch {
        setResults([]);
      }
    }, 200);
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    searchUsers(val.trim());
    setShowDropdown(true);
  };

  const handleSelectUser = (user: UserOption) => {
    onChange([...selectedContacts, {
      type: "user",
      userId: user.id,
      name: user.name,
      department: user.department,
    }]);
    setQuery("");
    setShowDropdown(false);
  };

  const handleAddManual = () => {
    if (!manualName.trim()) return;
    onChange([...selectedContacts, { type: "manual", name: manualName.trim() }]);
    setManualName("");
    setManualMode(false);
  };

  const handleRemove = (index: number) => {
    onChange(selectedContacts.filter((_, i) => i !== index));
  };

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex flex-wrap gap-1.5 p-2 min-h-[40px] border rounded-lg bg-zinc-900 text-zinc-100 ${error ? 'border-red-500/60' : 'border-zinc-700'} focus-within:border-[#111167] transition-colors`}>
        {selectedContacts.map((contact, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium ${
              contact.type === "user"
                ? "bg-[#111167]/15 text-[#9999cc] border border-[#111167]/25"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
            }`}
          >
            {contact.name}
            {contact.department && <span className="opacity-60">({contact.department})</span>}
            {contact.type === "manual" && <span className="opacity-60">(manual)</span>}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="ml-0.5 hover:text-red-400 transition-colors text-[14px] leading-none"
            >
              &times;
            </button>
          </span>
        ))}

        {!manualMode && (
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => { searchUsers(query); setShowDropdown(true); }}
            placeholder={selectedContacts.length === 0 ? (placeholder || "Search by name...") : ""}
            className="flex-1 min-w-[100px] bg-transparent outline-none text-[13px] text-zinc-100 placeholder-zinc-600"
          />
        )}
      </div>

      {manualMode && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddManual(); } }}
            placeholder="Enter name manually"
            className="flex-1 border px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-100 border-zinc-700 text-[13px] focus:outline-none focus:border-[#111167]"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddManual}
            className="px-3 py-1.5 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[12px] font-medium transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setManualMode(false); setManualName(""); }}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[12px] font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {showDropdown && !manualMode && (
        <div className="absolute z-50 w-full mt-1 bg-[#111113] border border-zinc-800 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
          {results.length > 0 ? (
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                className="w-full text-left px-3 py-2 hover:bg-zinc-800/60 transition-colors flex justify-between items-center text-[13px]"
              >
                <span className="text-zinc-100">{user.name}</span>
                <span className="text-zinc-500 text-[12px]">{user.department}</span>
              </button>
            ))
          ) : query.trim() ? (
            <div className="px-3 py-3 text-zinc-500 text-[13px] text-center">
              No results
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => { setManualMode(true); setShowDropdown(false); setManualName(query); setQuery(""); }}
            className="w-full text-left px-3 py-2 hover:bg-zinc-800/60 transition-colors border-t border-zinc-800 text-[12px] text-zinc-500"
          >
            + Manual entry (non-ERP staff)
          </button>
        </div>
      )}

      {error && <div className="text-red-400 text-[12px] mt-1">{error}</div>}
    </div>
  );
}
