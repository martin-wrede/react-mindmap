// --- START OF FILE MindMapEditor.jsx ---

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// --- Constants for Layout ---
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const H_SPACING = 80; // Horizontal space between levels
const V_SPACING = 30; // Vertical space between nodes at the same level

// --- Helper: Find a node in the tree by its ID ---
const findNode = (node, id) => {
    if (node.id === id) return node;
    // [FIX] Safely handle nodes with no 'children' property
    const children = node.children || [];
    for (const child of children) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
};

// --- Helper: Check if a node is a descendant of another (to prevent circular drops) ---
const isDescendant = (node, potentialParentId) => {
    if (node.id === potentialParentId) return true;
    // [FIX] Safely handle nodes with no 'children' property
    const children = node.children || [];
    for (const child of children) {
        if (isDescendant(child, potentialParentId)) return true;
    }
    return false;
};


// ====================================================================================
// --- MindMapNode Component: Renders a single node, its connector, and handles UI ---
// ====================================================================================
function MindMapNode({
    node, position, parentPosition, isEditing, isDropTarget, isGhost,
    onStartEdit, onSave, onCancel,
    onNodeMouseDown, onNodeMouseOver, onNodeMouseOut
}) {
    const [editText, setEditText] = useState(node.text);

    useEffect(() => { setEditText(node.text); }, [node.text]);

    const handleSave = () => onSave(node.id, editText);

    // --- Enhanced keyboard controls for editing ---
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line in textarea
            handleSave();
        }
        if (e.key === 'Escape') {
            onCancel();
        }
    };

    // --- Draws a smooth Bézier curve from the parent to this node ---
    const getConnectorPath = () => {
        if (!parentPosition) return null;
        const startX = parentPosition.x + NODE_WIDTH / 2;
        const startY = parentPosition.y;
        const endX = position.x - NODE_WIDTH / 2;
        const endY = position.y;

        const controlX = startX + (endX - startX) / 2;
        return `M ${startX},${startY} C ${controlX},${startY} ${controlX},${endY} ${endX},${endY}`;
    };

    const nodeStyle = {
        opacity: isGhost ? 0.3 : 1, // Make original node semi-transparent while dragging
        pointerEvents: isGhost ? 'none' : 'auto',
    };

    return (
        <g
            transform={`translate(${position.x - NODE_WIDTH / 2}, ${position.y - NODE_HEIGHT / 2})`}
            style={nodeStyle}
            // --- Drag-and-drop event handlers ---
            onMouseDown={(e) => onNodeMouseDown(e, node.id)}
            onMouseOver={(e) => { e.stopPropagation(); onNodeMouseOver(node.id); }}
            onMouseOut={(e) => { e.stopPropagation(); onNodeMouseOut(); }}
        >
            {parentPosition && !isGhost && (
                <path d={getConnectorPath()} fill="none" stroke="#a9a9a9" strokeWidth="2" />
            )}

            {isEditing ? (
                // --- EDIT MODE: Using <foreignObject> to render an HTML form ---
                <foreignObject x="0" y="0" width={NODE_WIDTH} height={NODE_HEIGHT + 30}>
                    <div xmlns="http://www.w3.org/1999/xhtml" className="node-form">
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <div className="node-buttons">
                            <button onClick={handleSave}>✓</button>
                            <button onClick={onCancel}>✕</button>
                        </div>
                    </div>
                </foreignObject>
            ) : (
                // --- DISPLAY MODE: Using standard SVG elements ---
                <g onDoubleClick={() => onStartEdit(node.id)}>
                    <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx="8"
                        fill="#f0f0f0"
                        stroke={isDropTarget ? '#007bff' : '#555'} // Highlight if it's a drop target
                        strokeWidth="2"
                        className="node-rect"
                    />
                    <foreignObject x="10" y="10" width={NODE_WIDTH - 20} height={NODE_HEIGHT - 20}>
                        <p xmlns="http://www.w3.org/1999/xhtml" className="node-text">{node.text}</p>
                    </foreignObject>
                </g>
            )}
        </g>
    );
}

// ====================================================================================
// --- Main MindMapEditor Component: Manages state, layout, and interactions ---
// ====================================================================================
export default function MindMapEditor({ initialData }) {
    const [data, setData] = useState(initialData);
    const [editingId, setEditingId] = useState(null);

    // --- State for Drag & Drop ---
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const [dropTargetId, setDropTargetId] = useState(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

    // --- State for Pan & Zoom ---
    const svgRef = useRef(null);
    const [viewBox, setViewBox] = useState({ x: -200, y: -400, width: 1000, height: 800 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // --- Memoized Layout Calculation ---
    const nodePositions = useMemo(() => {
        const positions = new Map();
        function calculatePositions(node, level, parentY) {
            const y = parentY;
            const x = level * (NODE_WIDTH + H_SPACING);
            positions.set(node.id, { x, y });

            // [FIX] The main source of the error. Default to an empty array.
            const children = node.children || [];
            const totalChildHeight = children.length * (NODE_HEIGHT + V_SPACING) - V_SPACING;
            let currentY = y - totalChildHeight / 2;

            children.forEach(child => {
                const childY = currentY + NODE_HEIGHT / 2;
                calculatePositions(child, level + 1, childY);
                currentY += NODE_HEIGHT + V_SPACING;
            });
        }
        if (data) {
             calculatePositions(data, 0, 0);
        }
        return positions;
    }, [data]);

    // --- Memoized Data for Ghost Node ---
    const draggingNodeData = useMemo(() => {
        if (!draggingNodeId || !data) return null;
        return findNode(data, draggingNodeId);
    }, [draggingNodeId, data]);


    // --- State Update Handlers ---
    const handleUpdateNode = useCallback((id, newText) => {
        const updateRecursively = (node) => {
            if (node.id === id) {
                return { ...node, text: newText };
            }
            // [FIX] Safely map over children that might not exist
            const children = node.children || [];
            return { ...node, children: children.map(child => updateRecursively(child)) };
        };
        setData(prevData => updateRecursively(prevData));
        setEditingId(null);
    }, []);

    const handleReparentNode = useCallback((draggedId, targetId) => {
        if (draggedId === targetId || draggedId === 'root') return;

        const draggedNode = findNode(data, draggedId);
        if (!draggedNode || isDescendant(draggedNode, targetId)) return;

        // 1. Remove node from old parent (immutable)
        const removeNode = (node, id) => {
            // [FIX] Safely filter children
            const children = node.children || [];
            const newChildren = children.filter(child => child.id !== id);
            return { ...node, children: newChildren.map(child => removeNode(child, id)) };
        };
        const dataWithoutNode = removeNode(data, draggedId);

        // 2. Add node to new parent (immutable)
        const addNode = (node, parentId, nodeToAdd) => {
            if (node.id === parentId) {
                const children = node.children || [];
                return { ...node, children: [...children, nodeToAdd] };
            }
            // [FIX] Safely map over children
            const children = node.children || [];
            return { ...node, children: children.map(child => addNode(child, parentId, nodeToAdd)) };
        };
        const newData = addNode(dataWithoutNode, targetId, draggedNode);
        setData(newData);
    }, [data]);


    // --- Global Mouse Event Handlers for Pan & Drag ---
    const handleNodeMouseDown = useCallback((e, nodeId) => {
        e.stopPropagation();
        if (nodeId !== 'root') {
            setDraggingNodeId(nodeId);
        }
    }, []);

    const handleGlobalMouseMove = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return;
        
        if (isPanning) {
            const CTM = svg.getScreenCTM();
            if (!CTM) return;
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            const scale = viewBox.width / svg.clientWidth;
            setViewBox(prev => ({ ...prev, x: prev.x - dx * scale, y: prev.y - dy * scale }));
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if (draggingNodeId) {
            const CTM = svg.getScreenCTM();
             if (!CTM) return;
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = e.clientX;
            svgPoint.y = e.clientY;
            const transformedPoint = svgPoint.matrixTransform(CTM.inverse());
            setDragPosition({ x: transformedPoint.x, y: transformedPoint.y });
        }
    }, [isPanning, draggingNodeId, panStart.x, panStart.y, viewBox.width]);

    const handleGlobalMouseUp = useCallback(() => {
        if (draggingNodeId && dropTargetId) {
            handleReparentNode(draggingNodeId, dropTargetId);
        }
        setDraggingNodeId(null);
        setDropTargetId(null);
        setIsPanning(false);
    }, [draggingNodeId, dropTargetId, handleReparentNode]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const zoomFactor = 1.1;
        const { clientX, clientY } = e;
        const { top, left, width, height } = svg.getBoundingClientRect();
        
        const mouseX = viewBox.x + (clientX - left) * (viewBox.width / width);
        const mouseY = viewBox.y + (clientY - top) * (viewBox.height / height);
        
        const newWidth = e.deltaY < 0 ? viewBox.width / zoomFactor : viewBox.width * zoomFactor;
        const newHeight = e.deltaY < 0 ? viewBox.height / zoomFactor : viewBox.height * zoomFactor;

        setViewBox({
            x: mouseX - (clientX - left) * (newWidth / width),
            y: mouseY - (clientY - top) * (newHeight / height),
            width: newWidth,
            height: newHeight
        });
    }, [viewBox]);

    // --- Recursive Rendering Function ---
    const renderNodes = useCallback((node, parentPosition) => {
        const position = nodePositions.get(node.id);
        if (!position) return null;

        const currentNode = (
            <MindMapNode
                key={node.id}
                node={node}
                position={position}
                parentPosition={parentPosition}
                isEditing={editingId === node.id}
                isDropTarget={dropTargetId === node.id && draggingNodeId !== node.id}
                isGhost={draggingNodeId === node.id}
                onStartEdit={setEditingId}
                onSave={handleUpdateNode}
                onCancel={() => setEditingId(null)}
                onNodeMouseDown={handleNodeMouseDown}
                onNodeMouseOver={setDropTargetId}
                onNodeMouseOut={() => setDropTargetId(null)}
            />
        );
        // [FIX] Safely map over children
        const children = node.children || [];
        const childNodes = children.map(child => renderNodes(child, position));
        return [currentNode, ...childNodes].flat();
    }, [nodePositions, editingId, dropTargetId, draggingNodeId, handleUpdateNode, handleNodeMouseDown]);


    return (
        <div
            className="mindmap-container"
            onMouseMove={handleGlobalMouseMove}
            onMouseUp={handleGlobalMouseUp}
            onMouseLeave={handleGlobalMouseUp}
        >
            <svg
                ref={svgRef}
                width="100%"
                height="80vh"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                onMouseDown={(e) => { setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY }); }}
                onWheel={handleWheel}
                style={{ cursor: isPanning ? 'grabbing' : (draggingNodeId ? 'move' : 'grab'), border: '1px solid #ccc', userSelect: 'none' }}
            >
                <defs>
                    <style>{`
                        .node-rect { cursor: pointer; transition: fill 0.2s, stroke 0.2s; }
                        .node-rect:hover { fill: #e0e0e0; }
                        .node-text { font-family: sans-serif; font-size: 14px; margin: 0; color: #333; text-align: center; word-wrap: break-word; }
                        .node-form { display: flex; flex-direction: column; height: 100%; }
                        .node-form textarea {
                            flex-grow: 1; border: 1px solid #007bff; border-radius: 4px; padding: 5px;
                            font-family: sans-serif; font-size: 14px; resize: none;
                        }
                        .node-buttons { display: flex; justify-content: flex-end; gap: 5px; margin-top: 5px; }
                        .node-buttons button { border: none; background: #ccc; border-radius: 4px; cursor: pointer; padding: 2px 8px; }
                        .node-buttons button:first-of-type { background: #28a745; color: white; }
                    `}</style>
                </defs>

                {/* Main group to center the root node */}
                <g transform="translate(100, 300)">
                    {data && renderNodes(data, null)}
                </g>

                {/* Render the "ghost" node that follows the cursor while dragging */}
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

// --- END OF FILE MindMapEditor.jsx ---