# [suggestionId]

Dynamic scope for one edge suggestion.

Child routes:

- `accept/`: apply the suggestion to the graph
- `reject/`: mark the suggestion as rejected

Suggestions should remain auditable in `graph.edgeSuggestions`; accepting or rejecting changes the status rather than deleting the record.

