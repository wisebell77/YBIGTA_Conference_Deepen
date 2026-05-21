# edge-suggestions

Routes for resolving LLM-generated or conflict-generated edge suggestions.

Suggestions exist when the system finds a plausible relationship but should not automatically overwrite or create an edge, usually because confidence is medium or because the suggestion conflicts with an existing edge.

Specific suggestion actions live under `[suggestionId]/`.

