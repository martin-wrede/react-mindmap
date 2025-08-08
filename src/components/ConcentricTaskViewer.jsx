// --- START OF FILE ConcentricTaskViewer.jsx (Final, Robust Version) ---

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// --- Constants ---
const CIRCLE_RADII = [120, 283, 510, 737];
const BAR_HEIGHT = 22;
const ROOT_FONT_SIZE = 20;

// --- Helper Functions ---
const findNode = (node, id) => {
    if (!node || !id) return null;
    if (node.id === id) return node;
    const children = node.children || [];
    for (const child of children) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
};

// --- TaskBar Sub-Component (No changes needed) ---
const TaskBar = React.memo(({ task, x, y, width, height, isEditing, isSelected, editedText, onTextChange, onTextBlur, onDoubleClick, onClick }) => {
    const barColor = ['#ff8a80', '#ffd700', '#cce5ff'][task.level - 1] || '#d6d8db';

    return (
        <g transform={`translate(0, ${y})`} onClick={() => onClick(task.id)} onDoubleClick={() => onDoubleClick(task.id)}>
            {isEditing ? (
                 <foreignObject x={x} y="0" width={width} height={height}>
                     <div xmlns="http://www.w3.org/1999/xhtml" className="task-form">
                        <input type="text" value={editedText} onChange={onTextChange} onBlur={onTextBlur} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') onTextBlur(); }} />
                    </div>
                </foreignObject>
            ) : (
                <>
                    <rect x={x} y="0" width={width} height={height} fill={barColor} stroke={isSelected ? '#007bff' : '#333'} strokeWidth="1" style={{ cursor: 'pointer' }} />
                    <text x={x + 10} y={height / 2} dy=".35em" fill="#000" style={{ pointerEvents: 'none', userSelect: 'none', fontSize: '13px' }}>
                        {task.text}
                    </text>
                </>
            )}
        </g>
    );
});

// --- TaskGroup Sub-Component (SIMPLIFIED - NO LONGER RECURSIVE) ---
const TaskGroup = React.memo(({ tasks, level, rotation, editingState, selectionState, eventHandlers }) => {
    const baseRadius = CIRCLE_RADII[level - 1];
    const outerRadius = CIRCLE_RADII[level] || (baseRadius + 200);
    const barWidth = outerRadius - baseRadius;
    const totalGroupHeight = tasks.length * BAR_HEIGHT;
    const startY = -totalGroupHeight / 2;

    return (
        <g transform={`rotate(${rotation})`}>
            {tasks.map((task, index) => (
                <TaskBar
                    key={task.id}
                    task={task}
                    x={baseRadius}
                    y={startY + index * BAR_HEIGHT}
                    width={barWidth}
                    height={BAR_HEIGHT}
                    isEditing={editingState.editingId === task.id}
                    isSelected={selectionState.selectedId === task.id}
                    editedText={editingState.editedText}
                    {...eventHandlers}
                />
            ))}
        </g>
    );
});

// --- Main ConcentricTaskViewer Component ---
export default function ConcentricTaskViewer({ initialData, groupedTasks }) {
    const [data, setData] = useState(initialData);
    const [viewBox, setViewBox] = useState({ x: -800, y: -800, width: 1600, height: 1600 });
    const [selectedId, setSelectedId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editedText, setEditedText] = useState('');
    
    const [rotations] = useState({ 1: -13.51, 2: -3.43, 3: -1.87 });
    
    const interactionRef = useRef({ type: 'none', startPos: { x: 0, y: 0 } });
    const svgRef = useRef(null);

    useEffect(() => { setData(initialData); }, [initialData]);

    const handleTextBlur = useCallback(() => {
        if (!editingId) return;
        const node = findNode(data, editingId);
        if(node && node.text !== editedText) {
            setData(prev => {
                const update = n => n.id === editingId ? { ...n, text: editedText } : { ...n, children: (n.children || []).map(update) };
                return update(prev);
            });
        }
        setEditingId(null);
    }, [editingId, editedText, data]);
    
    // ... (All other handlers: handleBackgroundMouseDown, handleMouseMove, handleMouseUp, handleWheel are unchanged) ...
    const handleBackgroundMouseDown = (e) => { handleTextBlur(); setSelectedId(null); interactionRef.current = { type: 'pan', startPos: { x: e.clientX, y: e.clientY } }; };
    const handleMouseMove = useCallback((e) => { const { type, startPos } = interactionRef.current; const svg = svgRef.current; if (!svg || type !== 'pan') return; const dx = e.clientX - startPos.x; const dy = e.clientY - startPos.y; const scale = viewBox.width / svg.clientWidth; setViewBox(prev => ({ ...prev, x: prev.x - dx * scale, y: prev.y - dy * scale })); interactionRef.current.startPos = { x: e.clientX, y: e.clientY }; }, [viewBox]);
    const handleMouseUp = useCallback(() => { interactionRef.current = { type: 'none' }; }, []);
    const handleWheel = useCallback((e) => { e.preventDefault(); const svg = svgRef.current; if (!svg) return; const { clientX, clientY } = e; const { top, left, width, height } = svg.getBoundingClientRect(); const mouseX = viewBox.x + (clientX - left) * (viewBox.width / width); const mouseY = viewBox.y + (clientY - top) * (viewBox.height / height); const zoomFactor = 1.1; const newWidth = e.deltaY < 0 ? viewBox.width / zoomFactor : viewBox.width * zoomFactor; const newHeight = e.deltaY < 0 ? viewBox.height / zoomFactor : viewBox.height * zoomFactor; setViewBox({ x: mouseX - (clientX - left) * (newWidth / width), y: mouseY - (clientY - top) * (newHeight / height), width: newWidth, height: newHeight }); }, [viewBox]);


    const handleNodeDoubleClick = useCallback((nodeId) => {
        const node = findNode(data, nodeId);
        if (node) {
            setEditingId(nodeId);
            setEditedText(node.text);
            setSelectedId(nodeId);
        }
    }, [data]);
    
    const editingState = useMemo(() => ({ editingId, editedText }), [editingId, editedText]);
    const selectionState = useMemo(() => ({ selectedId }), [selectedId]);
    const eventHandlers = useMemo(() => ({ onTextChange: (e) => setEditedText(e.target.value), onTextBlur: handleTextBlur, onDoubleClick: handleNodeDoubleClick, onClick: setSelectedId }), [handleTextBlur, handleNodeDoubleClick]);

    return (
        <div onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{backgroundColor: '#fff'}}>
            <svg ref={svgRef} width="100%" height="90vh" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} onMouseDown={handleBackgroundMouseDown} onWheel={handleWheel} style={{ cursor: interactionRef.current.type === 'pan' ? 'grabbing' : 'grab', border: '1px solid #ccc', userSelect: 'none' }}>
                <defs><style>{`.task-form input { width: 100%; height: 100%; box-sizing: border-box; border: 1px solid #007bff; font-family: sans-serif; font-size: 13px; padding-left: 10px; }`}</style></defs>
                <g>
                    {CIRCLE_RADII.slice().reverse().map((radius, index) => ( <circle key={radius} cx="0" cy="0" r={radius} fill={['#555555', '#777777', '#999999', '#eeeeee'][index]} stroke="#ffffff" strokeWidth="2" /> ))}
                    <foreignObject x={-CIRCLE_RADII[0]} y={-CIRCLE_RADII[0]} width={CIRCLE_RADII[0] * 2} height={CIRCLE_RADII[0] * 2}>
                        <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', fontSize: `${ROOT_FONT_SIZE}px`, fontWeight: 'bold' }}> {data?.text} </div>
                    </foreignObject>
                    
                    {/* NEW, SIMPLIFIED RENDER LOOP */}
                    {Object.keys(groupedTasks).sort().map(levelStr => {
                        const level = parseInt(levelStr, 10);
                        return (
                             <TaskGroup
                                key={level}
                                tasks={groupedTasks[level]}
                                level={level}
                                rotation={rotations[level] || 0}
                                editingState={editingState}
                                selectionState={selectionState}
                                eventHandlers={eventHandlers}
                            />
                        )
                    })}
                </g>
            </svg>
        </div>
    );
}