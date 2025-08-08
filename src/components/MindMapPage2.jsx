// Example: MindMapPage.jsx

import React from 'react';
import MindMapEditor from './MindMapEditor';

// Your provided JSON data
const yourFlatJsonData = [
  {
    "id": "task-1",
    "parentId": null,
    "date": "2025-08-01",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Recherche zu Wasserproblemen und bestehenden Lösungen",
    "motivation": "Förderung des Verständnisses für Herausforderungen und Lösungsansätze im Bereich Wasser"
  },
  {
    "id": "task-1.1",
    "parentId": "task-1",
    "date": "2025-08-01",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Sammlung globaler Wasserprobleme",
    "motivation": "Erfassung der Vielfalt und Komplexität der Wasserthematik weltweit"
  },
  {
    "id": "task-1.2",
    "parentId": "task-1",
    "date": "2025-08-02",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Analyse regionaler Wasserprobleme",
    "motivation": "Berücksichtigung lokaler Besonderheiten für zielgerichtete Lösungen"
  },
  {
    "id": "task-1.3",
    "parentId": "task-1",
    "date": "2025-08-03",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Vergleich existierender Wasserlösungsansätze",
    "motivation": "Gewinnung von Erkenntnissen durch Gegenüberstellung bestehender Ansätze"
  },
  {
    "id": "task-1.4",
    "parentId": "task-1",
    "date": "2025-08-04",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Identifikation von Marktlücken und Innovationschancen",
    "motivation": "Aufdeckung von Potenzialen für bahnbrechende Innovationen"
  },
  {
    "id": "task-2",
    "parentId": null,
    "date": "2025-08-05",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Erstellung einer Value Proposition",
    "motivation": "Klarheit über den angebotenen Mehrwert und die Alleinstellungsmerkmale schaffen"
  },
  {
    "id": "task-2.1",
    "parentId": "task-2",
    "date": "2025-08-05",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Definition der Kernbotschaft",
    "motivation": "Verdichtung des Angebots in eine prägnante und überzeugende Botschaft"
  },
  {
    "id": "task-2.2",
    "parentId": "task-2",
    "date": "2025-08-06",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Abgrenzung zum Wettbewerb",
    "motivation": "Herausarbeitung der einzigartigen Vorteile gegenüber Konkurrenten"
  },
  {
    "id": "task-2.3",
    "parentId": "task-2",
    "date": "2025-08-07",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Entwicklung eines Value Proposition Canvas",
    "motivation": "Visualisierung der Wertversprechen und Kundenanforderungen"
  },
  {
    "id": "task-2.4",
    "parentId": "task-2",
    "date": "2025-08-08",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Validierung der Value Proposition mit Zielgruppe",
    "motivation": "Sicherstellung der Markttauglichkeit und Kundenorientierung"

  },

{
    "id": "task-2.4.1",
    "parentId": "nul",
    "date": "2025-08-08",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Validierung mit Zielgruppe 1",
    "motivation": "Sicherstellung der Markttauglichkeit und Kundenorientierung"
  },{
    "id": "task-2.4.2",
    "parentId": "task-2.4.1",
    "date": "2025-08-08",
    "dailyStartTime": "10:00",
    "dailyHours": 6,
    "task": "Validierung mit Zielgruppe 2",
    "motivation": "Sicherstellung der Markttauglichkeit und Kundenorientierung"
  },
  // Weitere Hauptaufgaben mit Unteraufgaben folgen dem gleichen Schema.

];

// This function remains the same and is crucial.
function buildTreeFromFlatData(flatData, rootId = null, rootText = "Projekt 123") {
    const nodeMap = new Map();
    // Create the central root node
    const tree = { id: 'root', text: rootText, children: [] }; 

    // Create a map of all nodes for easy lookup
    flatData.forEach(item => {
        // Add a 'level' property to each node to easily determine which circle it belongs to
        let level = (item.id.match(/\./g) || []).length + 1;
        nodeMap.set(item.id, { ...item, text: item.task, children: [], level: level });
    });

    // Link children to their parents
    flatData.forEach(item => {
        const childNode = nodeMap.get(item.id);
        if (item.parentId && nodeMap.has(item.parentId)) {
            const parentNode = nodeMap.get(item.parentId);
            parentNode.children.push(childNode);
        } else if (item.parentId === null || item.parentId === "nul") { // Handle both null and the typo "nul"
            // These are top-level tasks, children of the main project
            tree.children.push(childNode);
        }
    });

    return tree;
}

export default function MindMapPage() {
    const mindMapTreeData = buildTreeFromFlatData(yourFlatJsonData, null, "Projekt 123");

    return (
        <div>
            <h1>Concentric Task Visualizer</h1>
            <MindMapEditor initialData={mindMapTreeData} />
        </div>
    );
}