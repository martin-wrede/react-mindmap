// --- START OF FILE MindMapEditor.jsx ---

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Constants for Layout ---
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const H_SPACING = 80; // Horizontal space between levels
const V_SPACING = 30; // Vertical space between nodes at the same level

// --- The MindMapNode Component ---
// This component renders a single node and its connector line to its parent.
// It handles switching between display and edit mode.
function MindMapNode({ node, position, isEditing, onStartEdit, onSave, onCancel, parentPosition }) {
    const [editText, setEditText] = useState(node.text);

    useEffect(() => {
        setEditText(node.text); // Sync with external changes
    }, [node.text]);

    const handleSave = () => {
        onSave(node.id, editText);
    };
    
    // --- Connector Line ---
    // We draw a Bézier curve from the parent to this node for a smooth look.
    const getConnectorPath = () => {
        if (!parentPosition) return null;
        
        const startX = parentPosition.x + NODE_WIDTH / 2;
        const startY = parentPosition.y;
        
        const endX = position.x - NODE_WIDTH / 2;
        const endY = position.y;

        // Control points for the curve
        const cp1x = startX + H_SPACING * 0.6;
        const cp1y = startY;
        const cp2x = endX - H_SPACING * 0.6;
        const cp2y = endY;

        return `M ${startX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}`;
    };

    return (
        <g transform={`translate(${position.x - NODE_WIDTH / 2}, ${position.y - NODE_HEIGHT / 2})`}>
            {parentPosition && (
                <path d={getConnectorPath()} fill="none" stroke="#a9a9a9" strokeWidth="2" />
            )}
            
            {isEditing ? (
                 // --- EDIT MODE: Using <foreignObject> to render an HTML form ---
                <foreignObject x="0" y="0" width={NODE_WIDTH} height={NODE_HEIGHT + 30}>
                    <div xmlns="http://www.w3.org/1999/xhtml" className="node-form">
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
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
                <g onClick={() => onStartEdit(node.id)}>
                    <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx="8"
                        fill="#f0f0f0"
                        stroke="#555"
                        strokeWidth="1.5"
                        className="node-rect"
                    />
                    {/* We use foreignObject here too for easy text wrapping! */}
                    <foreignObject x="10" y="10" width={NODE_WIDTH - 20} height={NODE_HEIGHT - 20}>
                        <p xmlns="http://www.w3.org/1999/xhtml" className="node-text">
                            {node.text}
                        </p>
                    </foreignObject>
                </g>
            )}
        </g>
    );
}


// --- The Main MindMapEditor Component ---
export default function MindMapEditor({ initialData }) {
    const [data, setData] = useState(initialData);
    const [editingId, setEditingId] = useState(null);

    // --- Pan & Zoom State ---
    const [viewBox, setViewBox] = useState({ x: -300, y: -400, width: 800, height: 800 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // --- Layout Calculation ---
    // This is a recursive function that calculates the x,y position for every node.
    const nodePositions = useMemo(() => {
        const positions = new Map();
        let maxY = 0;

        function calculatePositions(node, level, parentY) {
            const y = parentY;
            const x = level * (NODE_WIDTH + H_SPACING);
            positions.set(node.id, { x, y });
            
            maxY = Math.max(maxY, y);
            
            const totalChildHeight = node.children.length * (NODE_HEIGHT + V_SPACING) - V_SPACING;
            let currentY = y - totalChildHeight / 2;

            node.children.forEach(child => {
                const childY = currentY + NODE_HEIGHT / 2;
                calculatePositions(child, level + 1, childY);
                currentY += NODE_HEIGHT + V_SPACING;
            });
        }
        
        calculatePositions(data, 0, 0); // Start calculation from the root node
        return positions;
    }, [data]);

    // --- Recursive Rendering ---
    // This function flattens the tree into a list of components to render.
    const renderNodes = (node, parentPosition) => {
        const position = nodePositions.get(node.id);
        if (!position) return null;

        const currentNode = (
            <MindMapNode
                key={node.id}
                node={node}
                position={position}
                parentPosition={parentPosition}
                isEditing={editingId === node.id}
                onStartEdit={setEditingId}
                onSave={handleUpdateNode}
                onCancel={() => setEditingId(null)}
            />
        );

        const childNodes = node.children.map(child => renderNodes(child, position));
        
        return [currentNode, ...childNodes];
    };

    // --- Update Logic ---
    const handleUpdateNode = (id, newText) => {
        const updateRecursively = (node) => {
            if (node.id === id) {
                return { ...node, text: newText };
            }
            return { ...node, children: node.children.map(child => updateRecursively(child)) };
        };
        setData(updateRecursively(data));
        setEditingId(null);
    };
    
    // --- Pan & Zoom Handlers ---
    const handleMouseDown = (e) => {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (!isPanning) return;
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        // Adjust viewBox based on mouse movement
        // The scale factor depends on the current zoom level (viewBox width/height)
        const scale = viewBox.width / e.currentTarget.clientWidth;
        setViewBox(prev => ({ ...prev, x: prev.x - dx * scale, y: prev.y - dy * scale }));
        setPanStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const { clientX, clientY, currentTarget } = e;
        const { top, left, width, height } = currentTarget.getBoundingClientRect();
        
        // Mouse position in SVG coordinates
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
    };


    return (
        <div className="mindmap-container">
            <svg
                width="100%"
                height="80vh"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp} // Stop panning if mouse leaves SVG
                onWheel={handleWheel}
                style={{ cursor: isPanning ? 'grabbing' : 'grab', border: '1px solid #ccc' }}
            >
                <defs>
                    <style>{`
                        /* Style for nodes */
                        .node-rect { cursor: pointer; transition: fill 0.2s; }
                        .node-rect:hover { fill: #e0e0e0; }
                        .node-text { font-family: sans-serif; font-size: 14px; margin: 0; color: #333; text-align: center; }

                        /* Style for the form inside foreignObject */
                        .node-form { display: flex; flex-direction: column; height: 100%; }
                        .node-form textarea {
                            flex-grow: 1;
                            border: 1px solid #007bff;
                            border-radius: 4px;
                            padding: 5px;
                            font-family: sans-serif;
                            font-size: 14px;
                            resize: none;
                        }
                        .node-buttons { display: flex; justify-content: flex-end; gap: 5px; margin-top: 5px; }
                        .node-buttons button { border: none; background: #ccc; border-radius: 4px; cursor: pointer; padding: 2px 8px; }
                        .node-buttons button:first-of-type { background: #28a745; color: white; }
                    `}</style>
                </defs>

                {/* The transform here centers the whole mind map initially */}
                <g transform="translate(100, 300)">
                    {renderNodes(data, null)}
                </g>
            </svg>
        </div>
    );
}