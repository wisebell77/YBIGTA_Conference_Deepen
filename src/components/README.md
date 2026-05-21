# components

Client-side React components for the graph workspace.

Current components:

- `GraphWorkspace.tsx`: main application UI, graph loading, upload action, filters, detail panel, and edge editing UI
- `PaperNode.tsx`: custom React Flow node rendering for paper nodes

Components should not directly call Google Drive APIs or touch server files. Use `/api/...` routes for server actions, then render returned `GraphData`.

When changing layout, keep the current grayscale/minimal design unless the team explicitly decides to revise the visual language.

