// --- START OF FILE MindMapEditor.jsx (Final, Robust Version) ---

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// --- Constants ---
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const H_SPACING = 80;
const V_SPACING = 30;

// --- Helper Functions ---
const findNode = (node, id) => {
    if (!node) return null;
    if (node.id === id) return node;
    const children = node.children || [];
    for (const child of children) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
};
const isDescendant = (node, potentialParentId) => {
    if (!node) return false;
    if (node.id === potentialParentId) return true;
    const children = node.children || [];
    for (const child of children) {
        if (isDescendant(child, potentialParentId)) return true;
    }
    return false;
};

// --- MindMapNode Component ---
function MindMapNode({
    node, position, parentPosition, isEditing, isSelected, isDropTarget,
    onNodeMouseDown, onNodeDoubleClick, onNodeMouseOver, onNodeMouseOut,
    editedText, onTextChange, onTextBlur
}) {
    const getConnectorPath = () => {
        if (!parentPosition) return null;
        const startX = parentPosition.x + NODE_WIDTH / 2;
        const startY = parentPosition.y;
        const endX = position.x - NODE_WIDTH / 2;
        const endY = position.y;
        const controlX = startX + (endX - startX) / 2;
        return `M ${startX},${startY} C ${controlX},${startY} ${controlX},${endY} ${endX},${endY}`;
    };

    return (
        <g
            transform={`translate(${position.x - NODE_WIDTH / 2}, ${position.y - NODE_HEIGHT / 2})`}
            onMouseOver={(e) => { e.stopPropagation(); onNodeMouseOver(node.id); }}
            onMouseOut={(e) => { e.stopPropagation(); onNodeMouseOut(); }}
        >
            {parentPosition && <path d={getConnectorPath()} fill="none" stroke="#a9a9a9" strokeWidth="2" />}
            {isEditing ? (
                <foreignObject x="0" y="0" width={NODE_WIDTH} height={NODE_HEIGHT}>
                    <div xmlns="http://www.w3.org/1999/xhtml" className="node-form-miro">
                        <textarea value={editedText} onChange={onTextChange} onBlur={onTextBlur} autoFocus />
                    </div>
                </foreignObject>
            ) : (
                <g>
                    <rect
                        width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" fill="#f0f0f0"
                        stroke={isSelected ? '#007bff' : (isDropTarget ? '#28a745' : '#555')}
                        strokeWidth="2" className="node-rect"
                        onMouseDown={(e) => onNodeMouseDown(e, node.id)}
                        onDoubleClick={(e) => onNodeDoubleClick(e, node.id)}
                    />
                    <foreignObject x="10" y="10" width={NODE_WIDTH - 20} height={NODE_HEIGHT - 20} style={{ pointerEvents: 'none' }}>
                        <p xmlns="http://www.w3.org/1999/xhtml" className="node-text">{node.text}</p>
                    </foreignObject>
                </g>
            )}
        </g>
    );
}
const MemoizedMindMapNode = React.memo(MindMapNode);

// --- Main MindMapEditor Component ---
export default function MindMapEditor({ initialData }) {
    const [data, setData] = useState(initialData);
    const [viewBox, setViewBox] = useState({ x: -200, y: -400, width: 1000, height: 800 });
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editedText, setEditedText] = useState('');
    const [dropTargetId, setDropTargetId] = useState(null);
    const [ghostNode, setGhostNode] = useState(null);

    const interactionRef = useRef({ type: 'none', startPos: { x: 0, y: 0 } });
    const svgRef = useRef(null);

    const nodePositions = useMemo(() => {
        const positions = new Map();
        function calculatePositions(node, level, parentY) {
            if (!node) return;
            positions.set(node.id, { x: level * (NODE_WIDTH + H_SPACING), y: parentY });
            const children = node.children || [];
            const totalChildHeight = children.length * (NODE_HEIGHT + V_SPACING) - V_SPACING;
            let currentY = parentY - totalChildHeight / 2;
            children.forEach(child => { calculatePositions(child, level + 1, currentY + NODE_HEIGHT / 2); currentY += NODE_HEIGHT + V_SPACING; });
        }
        if (data) calculatePositions(data, 0, 0);
        return positions;
    }, [data]);

    const handleNodeMouseDown = useCallback((e, nodeId) => {
        e.stopPropagation();
        interactionRef.current = {
            type: 'drag',
            startPos: { x: e.clientX, y: e.clientY },
            nodeId: nodeId
        };
        setSelectedNodeId(nodeId);
    }, []);

    const handleNodeDoubleClick = useCallback((e, nodeId) => {
        e.stopPropagation();
        // [THE FIX #1] Explicitly cancel any drag operation when a double-click is detected.
        interactionRef.current = { type: 'edit' };
        setGhostNode(null); // Ensure no ghost node is shown

        const node = findNode(data, nodeId);
        if (node) {
            setEditingId(nodeId);
            setEditedText(node.text);
            setSelectedNodeId(nodeId); // An edited node is always selected
        }
    }, [data]);

    const handleBackgroundMouseDown = useCallback((e) => {
        if (editingId) {
            // This is the auto-save logic
            const node = findNode(data, editingId);
            if(node && node.text !== editedText) {
                setData(prev => {
                    if (!prev) return null;
                    const update = n => n.id === editingId ? { ...n, text: editedText } : { ...n, children: (n.children || []).map(update) };
                    return update(prev);
                });
            }
        }
        setEditingId(null);
        setSelectedNodeId(null);
        interactionRef.current = { type: 'pan', startPos: { x: e.clientX, y: e.clientY } };
    }, [editingId, editedText, data]);

    const handleMouseMove = useCallback((e) => {
        const { type, nodeId, startPos } = interactionRef.current;
        const svg = svgRef.current;
        if (!svg || type === 'none' || type === 'edit') return;

        if (type === 'pan') {
            const dx = e.clientX - startPos.x;
            const dy = e.clientY - startPos.y;
            const scale = viewBox.width / svg.clientWidth;
            setViewBox(prev => ({ ...prev, x: prev.x - dx * scale, y: prev.y - dy * scale }));
            interactionRef.current.startPos = { x: e.clientX, y: e.clientY };
        } else if (type === 'drag') {
            // [THE FIX #2] Create the ghost node here, on the first sign of movement.
            if (!ghostNode) {
                const nodeData = findNode(data, nodeId);
                if (nodeData) setGhostNode(nodeData);
            }

            const CTM = svg.getScreenCTM()?.inverse();
            if (!CTM) return;
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = e.clientX;
            svgPoint.y = e.clientY;
            const transformedPoint = svgPoint.matrixTransform(CTM);
            setGhostNode(prev => prev ? { ...prev, x: transformedPoint.x, y: transformedPoint.y } : null);
        }
    }, [viewBox, data, ghostNode]);

    const handleMouseUp = useCallback(() => {
        const { type, nodeId } = interactionRef.current;

        if (type === 'drag' && nodeId && dropTargetId && nodeId !== dropTargetId) {
            setData(prevData => {
                if (!prevData) return null;
                const draggedNode = findNode(prevData, nodeId);
                if (!draggedNode || isDescendant(draggedNode, dropTargetId)) return prevData;
                const removeNode = (n, id) => ({ ...n, children: (n.children || []).filter(c => c.id !== id).map(c => removeNode(c, id)) });
                const addNode = (n, pId, node) => n.id === pId ? { ...n, children: [...(n.children || []), node] } : { ...n, children: (n.children || []).map(c => addNode(c, pId, node)) };
                return addNode(removeNode(prevData, nodeId), dropTargetId, draggedNode);
            });
        }
        interactionRef.current = { type: 'none' };
        setGhostNode(null);
        setDropTargetId(null);
    }, [dropTargetId]);

    const handleTextBlur = useCallback(() => {
        if (!editingId) return;
        const node = findNode(data, editingId);
        if(node && node.text !== editedText) {
            setData(prev => {
                if (!prev) return null;
                const update = n => n.id === editingId ? { ...n, text: editedText } : { ...n, children: (n.children || []).map(update) };
                return update(prev);
            });
        }
        setEditingId(null);
    }, [editingId, editedText, data]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const svg = svgRef.current; if (!svg) return;
        const { clientX, clientY } = e;
        const { top, left, width, height } = svg.getBoundingClientRect();
        const mouseX = viewBox.x + (clientX - left) * (viewBox.width / width);
        const mouseY = viewBox.y + (clientY - top) * (viewBox.height / height);
        const zoomFactor = 1.1;
        const newWidth = e.deltaY < 0 ? viewBox.width / zoomFactor : viewBox.width * zoomFactor;
        const newHeight = e.deltaY < 0 ? viewBox.height / zoomFactor : viewBox.height * zoomFactor;
        setViewBox({ x: mouseX - (clientX - left) * (newWidth / width), y: mouseY - (clientY - top) * (newHeight / height), width: newWidth, height: newHeight });
    }, [viewBox]);

    const renderNodes = useCallback((node, parentPosition) => {
        if (!node) return null;
        const position = nodePositions.get(node.id);
        if (!position) return null;
        
        // Hide the original node while it's being dragged
        if (ghostNode && ghostNode.id === node.id) {
             const children = (node.children || []).map(child => renderNodes(child, position));
             return <React.Fragment key={`${node.id}-ghost-children`}>{children}</React.Fragment>;
        }

        return (
            <React.Fragment key={node.id}>
                <MemoizedMindMapNode
                    node={node} position={position} parentPosition={parentPosition}
                    isSelected={selectedNodeId === node.id}
                    isEditing={editingId === node.id}
                    isDropTarget={dropTargetId === node.id}
                    onNodeMouseDown={handleNodeMouseDown}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onNodeMouseOver={setDropTargetId}
                    onNodeMouseOut={() => setDropTargetId(null)}
                    editedText={editedText}
                    onTextChange={(e) => setEditedText(e.target.value)}
                    onTextBlur={handleTextBlur}
                />
                {(node.children || []).map(child => renderNodes(child, position))}
            </React.Fragment>
        );
    }, [nodePositions, selectedNodeId, editingId, dropTargetId, ghostNode, editedText, handleNodeMouseDown, handleNodeDoubleClick, handleTextBlur]);

    return (
        <div onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <svg
                ref={svgRef} width="100%" height="80vh" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                onMouseDown={handleBackgroundMouseDown} onWheel={handleWheel}
                style={{ cursor: interactionRef.current.type === 'pan' ? 'grabbing' : (interactionRef.current.type === 'drag' ? 'move' : 'grab'), border: '1px solid #ccc', userSelect: 'none' }}
            >
                <defs>
                    <style>{`
                        .node-rect { cursor: pointer; transition: stroke 0.2s; }
                        .node-text { font-family: sans-serif; font-size: 14px; margin: 0; color: #333; text-align: center; word-wrap: break-word; }
                        .node-form-miro textarea {
                            width: 100%; height: 100%; box-sizing: border-box;
                            border: 2px solid #007bff; border-radius: 8px;
                            padding: 8px; font-family: sans-serif; font-size: 14px; resize: none; text-align: center;
                            background-color: #f0f0f0;
                        }
                    `}</style>
                </defs>
                <g transform="translate(100, 300)">{data && renderNodes(data, null)}</g>
                {ghostNode && (
                    <g transform={`translate(${ghostNode.x}, ${ghostNode.y})`} style={{ pointerEvents: 'none', opacity: 0.7 }}>
                        <rect x={-NODE_WIDTH / 2} y={-NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" fill="#d0e8ff" stroke="#007bff" />
                        <foreignObject x={-NODE_WIDTH / 2 + 10} y={-NODE_HEIGHT / 2 + 10} width={NODE_WIDTH - 20} height={NODE_HEIGHT - 20}>
                            <p xmlns="http://www.w3.org/1999/xhtml" className="node-text">{ghostNode.text}</p>
                        </foreignObject>
                    </g>
                )}
            </svg>
        </div>
    );
}