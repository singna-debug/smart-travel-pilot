import React, { useState } from 'react';
import { ChevronDown, Calendar, MapPin, Pencil } from 'lucide-react';

export function EditableField({ 
    label, value, field, chatId, onSave, options, allowClickToEdit = false, wide = false, multiline = false, forceEditMode = false, displayValue 
}: { 
    label: string; 
    value: string; 
    field: string; 
    chatId: string; 
    onSave: (chatId: string, field: string, newValue: string) => Promise<void>; 
    options?: string[];
    allowClickToEdit?: boolean;
    wide?: boolean;
    multiline?: boolean;
    forceEditMode?: boolean;
    displayValue?: React.ReactNode;
}) {
    const [localIsEditing, setLocalIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value || '');
    const [isSaving, setIsSaving] = useState(false);

    const activeEditMode = forceEditMode || localIsEditing;

    React.useEffect(() => {
        setEditValue(value || '');
    }, [value]);

    const handleSave = async (newValue: string) => {
        if (newValue !== value) {
            setIsSaving(true);
            await onSave(chatId, field, newValue);
            setIsSaving(false);
        } else {
            setLocalIsEditing(false);
        }
    };

    return (
        <div style={{ gridColumn: wide ? 'span 2' : undefined, position: 'relative' }}>
            {label && <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>}
            {activeEditMode ? (
                <div style={{ display: 'flex', gap: '4px' }}>
                    {options ? (
                        <div style={{ position: 'relative', width: '100%' }}>
                            <select
                                autoFocus={localIsEditing && !forceEditMode}
                                value={editValue}
                                onChange={(e) => {
                                    setEditValue(e.target.value);
                                    handleSave(e.target.value);
                                }}
                                onBlur={() => setLocalIsEditing(false)}
                                style={{
                                    width: '100%', padding: '4px 24px 4px 8px', fontSize: '12px', background: '#374151', color: '#fff', 
                                    border: '1px solid #3b82f6', borderRadius: '4px', outline: 'none', 
                                    appearance: 'none', cursor: 'pointer'
                                }}
                                disabled={isSaving}
                            >
                                <option value="">(선택)</option>
                                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    ) : multiline ? (
                        <textarea 
                            autoFocus={localIsEditing && !forceEditMode}
                            value={editValue} 
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={(e) => handleSave(e.target.value)}
                            style={{
                                flex: 1, padding: '8px', fontSize: '13px', background: '#374151', color: '#fff', 
                                border: '1px solid #3b82f6', borderRadius: '4px', outline: 'none', width: '100%',
                                minHeight: '100px', resize: 'vertical'
                            }}
                            disabled={isSaving}
                        />
                    ) : (
                        <input 
                            autoFocus={localIsEditing && !forceEditMode}
                            value={editValue} 
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={(e) => handleSave(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(e.currentTarget.value); if (e.key === 'Escape') { setLocalIsEditing(false); setEditValue(value || ''); } }}
                            style={{
                                flex: 1, padding: '4px 8px', fontSize: '12px', background: '#374151', color: '#fff', 
                                border: '1px solid #3b82f6', borderRadius: '4px', outline: 'none', width: '100%'
                            }}
                            disabled={isSaving}
                        />
                    )}
                </div>
            ) : (
                <div 
                    onClick={() => { if (allowClickToEdit) setLocalIsEditing(true) }}
                    style={{ 
                        fontSize: '13px', color: '#e5e7eb', fontWeight: 500, 
                        cursor: allowClickToEdit ? 'pointer' : 'default', padding: '2px 4px', margin: '-2px -4px', borderRadius: '4px',
                        border: '1px solid transparent', transition: '0.2s',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                        wordBreak: 'break-all', whiteSpace: multiline ? 'pre-wrap' : 'normal',
                    }}
                    onMouseEnter={e => { if (allowClickToEdit) e.currentTarget.style.border = '1px dashed #4b5563'; }}
                    onMouseLeave={e => { e.currentTarget.style.border = '1px solid transparent'; }}
                    title={allowClickToEdit ? "클릭하여 수정" : undefined}
                >
                    <span style={{ flex: 1, width: '100%' }}>{isSaving ? <span style={{color: '#9ca3af'}}>저장 중...</span> : (displayValue !== undefined ? displayValue : (value || <span style={{color: '#6b7280'}}>-</span>))}</span>
                </div>
            )}
        </div>
    );
}

export function InfoCell({ label, value, highlight, wide }: { label: string; value: string; highlight?: string; wide?: boolean }) {
    return (
        <div style={{ gridColumn: wide ? 'span 2' : undefined }}>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            {highlight ? (
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: `${highlight}20`, color: highlight }}>{value}</span>
            ) : (
                <div style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>{value}</div>
            )}
        </div>
    );
}

export function TimelineCell({ label, date, today, field, chatId, onCheck }: { label: string; date: string; today: string, field?: string, chatId?: string, onCheck?: (chatId: string, field: string, newValue: string) => Promise<void> }) {
    if (!date) return null;
    
    const isChecked = date.includes('(완료)');
    const cleanDate = date.replace('(완료)', '').trim();

    const isToday = cleanDate.startsWith(today);
    let isPast = false;
    try { isPast = new Date(cleanDate) < new Date(today); } catch { }

    const handleCheckboxToggle = () => {
        if (!onCheck || !chatId || !field) return;
        const newValue = isChecked ? cleanDate : `${cleanDate} (완료)`;
        onCheck(chatId, field, newValue);
    };

    return (
        <div style={{
            padding: '8px', background: isToday ? 'rgba(245, 158, 11, 0.1)' : '#111827',
            border: isToday ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
            borderRadius: '6px', fontSize: '11px', opacity: isPast && !isChecked ? 0.6 : 1,
        }}>
            <div style={{ color: '#6b7280', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{label}</span>
                {onCheck && (
                    <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={handleCheckboxToggle}
                        style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: '#10b981', margin: 0 }}
                        title="완료 체크"
                    />
                )}
            </div>
            <div style={{ color: isChecked ? '#9ca3af' : '#e5e7eb', textDecoration: isChecked ? 'line-through' : 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {cleanDate}
                {isToday && !isChecked && <span style={{ background: '#f59e0b', color: '#000', padding: '0 4px', borderRadius: '3px', fontSize: '9px', fontWeight: 700 }}>오늘</span>}
                {isChecked && <span style={{ background: '#10b98120', color: '#10b981', padding: '0 4px', borderRadius: '3px', fontSize: '9px', fontWeight: 700 }}>완료</span>}
            </div>
        </div>
    );
}
