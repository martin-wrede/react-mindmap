// --- START OF FILE MindMapEditor.jsx ---

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// --- Constants for Layout (Unchanged) ---
const NODE_WIDTH = 180, NODE_HEIGHT = 60, H_SPACING = 80, V_SPACING = 30;

// --- Helper Functions (Unchanged) ---
 
const findNode = (node, id) => {
    if (node.id === id) return node;
    const children = node.children || [];
    for (const child of children) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
};
const isDescendant = (node, potentialParentId) => {
    if (node.id === potentialParentId) return true;
    const children = node.children || [];
    for (const child of children) {
        if (isDescendant(child, potentialParentId)) return true;
    }
    return false;
};
// --- MindMapNode Component (Unchanged) ---
function MindMapNode({
    node, position, parentPosition, isEditing, isDropTarget, isGhost,
    onStartEdit, onSave, onCancel,
    onNodeMouseDown, onNodeMouseOver, onNodeMouseOut
}) {
    const [editText, setEditText] = useState(node.text);
    useEffect(() => { setEditText(node.text); }, [node.text]);
    const handleSave = () => onSave(node.id, editText);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
        if (e.key === 'Escape') { onCancel(); }
    };
    const getConnectorPath = () => {
        if (!parentPosition) return null;
        const startX = parentPosition.x + NODE_WIDTH / 2, startY = parentPosition.y;
        const endX = position.x - NODE_WIDTH / 2, endY = position.y;
        const controlX = startX + (endX - startX) / 2;
        return `M ${startX},${startY} C ${controlX},${startY} ${controlX},${endY} ${endX},${endY}`;
    };
    const nodeStyle = { opacity: isGhost ? 0.3 : 1, pointerEvents: isGhost ? 'none' : 'auto' };

    return (
        <g transform={`translate(${position.x - NODE_WIDTH / 2}, ${position.y - NODE_HEIGHT / 2})`} style={nodeStyle}
           onMouseDown={(e) => onNodeMouseDown(e, node.id)}
           onMouseOver={() => onNodeMouseOver(node.id)}
           onMouseOut={onNodeMouseOut}>
            {parentPosition && !isGhost && <path d={getConnectorPath()} fill="none" stroke="#a9a9a9" strokeWidth="2" />}
            {isEditing ? (
                <foreignObject x="0" y="0" width={NODE_WIDTH} height={NODE_HEIGHT + 30}>
                    <div xmlns="http://www.w3.org/1999/xhtml" className="node-form">
                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
                        <div className="node-buttons"><button onClick={handleSave}>✓</button><button onClick={onCancel}>✕</button></div>
                    </div>
                </foreignObject>
            ) : (
                <g onDoubleClick={() => onStartEdit(node.id)}>
                    <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" fill="#f0f0f0" stroke={isDropTarget ? '#007bff' : '#555'} strokeWidth="2" className="node-rect" />
                    <foreignObject x="10" y="10" width={NODE_WIDTH - 20} height={NODE_HEIGHT - 20}>
                        <p xmlns="http://www.w3.org/1999/xhtml" className="node-text">{node.text}</p>
                    </foreignObject>
                </g>
            )}
        </g>
    );
}

// ====================================================================================
// --- Main MindMapEditor Component with Miro-Style Navigation ---
// ====================================================================================
export default function MindMapEditor({ initialData }) {
    const [data, setData] = useState(initialData);
    const [editingId, setEditingId] = useState(null);
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const [dropTargetId, setDropTargetId] = useState(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    
    // --- State for Miro-Style Navigation ---
    const [isSpacebarPressed, setIsSpacebarPressed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const svgRef = useRef(null);
    const [viewBox, setViewBox] = useState({ x: -200, y: -400, width: 1000, height: 800 });

    // --- Global Keyboard Event Listeners (Unchanged) ---
  
      // --- [MIRO-STYLE] Global Keyboard Event Listeners for Spacebar ---
      useEffect(() => {
          const handleKeyDown = (e) => {
              if (e.code === 'Space' && !editingId) { // Don't trigger if typing in a textarea
                  e.preventDefault();
                  setIsSpacebarPressed(true);
              }
          };
          const handleKeyUp = (e) => {
              if (e.code === 'Space') {
                  setIsSpacebarPressed(false);
                  setIsPanning(false); // Stop panning when space is released
              }
          };
          window.addEventListener('keydown', handleKeyDown);
          window.addEventListener('keyup', handleKeyUp);
          return () => {
              window.removeEventListener('keydown', handleKeyDown);
              window.removeEventListener('keyup', handleKeyUp);
          };
      }, [editingId]); // Re-evaluate if we are in editing mode
  

    // --- [FIX #1] Robust Layout Calculation ---
    const nodePositions = useMemo(() => {
        // Always initialize as a Map to prevent it from being undefined.
        const positions = new Map();
        if (!data) {
            return positions; // Return an empty map if there's no data
        }
        function calculatePositions(node, level, parentY) {
            const y = parentY;
            const x = level * (NODE_WIDTH + H_SPACING);
            positions.set(node.id, { x, y });
            const children = node.children || [];
            const totalChildHeight = children.length * (NODE_HEIGHT + V_SPACING) - V_SPACING;
            let currentY = y - totalChildHeight / 2;
            children.forEach(child => {
                const childY = currentY + NODE_HEIGHT / 2;
                calculatePositions(child, level + 1, childY);
                currentY += NODE_HEIGHT + V_SPACING;
            });
        }
        calculatePositions(data, 0, 0);
        return positions;
    }, [data]);

    // --- Data Handlers (Unchanged) ---
    const draggingNodeData = useMemo(() => { /* ... */ }, [draggingNodeId, data]);
    const handleUpdateNode = useCallback((id, newText) => { /* ... */ }, []);
    const handleReparentNode = useCallback((draggedId, targetId) => { /* ... */ }, [data]);

    // --- Mouse Handlers (Unchanged) ---
    const handleNodeMouseDown = useCallback((e, nodeId) => { /* ... */ }, [isSpacebarPressed]);
    const handleCanvasMouseDown = useCallback((e) => { /* ... */ }, [isSpacebarPressed]);
    const handleGlobalMouseMove = useCallback((e) => { /* ... */ }, [isPanning, isSpacebarPressed, panStart, draggingNodeId, viewBox.width]);
    const handleGlobalMouseUp = useCallback(() => { /* ... */ }, [draggingNodeId, dropTargetId, handleReparentNode]);
    const handleWheel = useCallback((e) => { /* ... */ }, [viewBox]);

    // --- Smart Cursor Logic (Unchanged) ---
    const getCursor = () => { /* ... */ };

    // --- Recursive Rendering Function ---
    const renderNodes = useCallback((node, parentPosition) => {
        // Defensive check: although nodePositions should now always be a Map,
        // this guard makes the function even more robust.
        if (!nodePositions) return null;

        const position = nodePositions.get(node.id);
        if (!position) return null; // Node might not have a calculated position yet

        const children = node.children || [];
        return [
            <MindMapNode key={node.id} node={node} position={position} parentPosition={parentPosition}
                         isEditing={editingId === node.id}
                         isDropTarget={dropTargetId === node.id && draggingNodeId !== node.id}
                         isGhost={draggingNodeId === node.id}
                         onStartEdit={setEditingId}
                         onSave={handleUpdateNode} onCancel={() => setEditingId(null)}
                         onNodeMouseDown={handleNodeMouseDown}
                         onNodeMouseOver={setDropTargetId} onNodeMouseOut={() => setDropTargetId(null)} />,
            ...children.map(child => renderNodes(child, position))
        ].flat();
    }, [nodePositions, editingId, dropTargetId, draggingNodeId, handleUpdateNode, handleNodeMouseDown]);

    return (
        <div className="mindmap-container"
             onMouseMove={handleGlobalMouseMove}
             onMouseUp={handleGlobalMouseUp}
             onMouseLeave={handleGlobalMouseUp}>
            <svg ref={svgRef} width="100%" height="80vh"
                 viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                 onMouseDown={handleCanvasMouseDown}
                 onWheel={handleWheel}
                 style={{ cursor: getCursor(), border: '1px solid #ccc', userSelect: 'none' }}>
                <defs>{/* CSS Styles */}</defs>
                <g transform="translate(100, 300)">
                    {/* [FIX #2] Guarded Render Call */}
                    {/* Only attempt to render if data and positions are ready. */}
                    {data && nodePositions.size > 0 && renderNodes(data, null)}
                </g>
                {/* Ghost Node Rendering (Unchanged) */}
                    {draggingNodeId && draggingNodeData && (
                    <g transform={`translate(${dragPosition.x}, ${dragPosition.y})`} style={{ pointerEvents: 'none', opacity: 0.7 }}>
                        <rect x={-NODE_WIDTH / 2} y={-NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" fill="#d0e8ff" stroke="#007bff" />
                        <foreignObject x={-NODE_WIDTH / 2 + 10} y={-NODE_HEIGHT / 2 + 10} width={NODE_WIDTH - 20} height={NODE_HEIGHT - 20}>
                            <p xmlns="http://www.w3.org/1999/xhtml" className="node-text">{draggingNodeData.text}</p>
                        </foreignObject>
                    </g>
                )}
            </svg>
        </div>
    );
}

// NOTE: The helper functions (findNode, isDescendant) and the MindMapNode component
// should be included here as they were in the previous correct version. I've omitted
// them for brevity, but they are essential for the file to work.