export function buildPrompt(relevantTables: string[], userQuestion: string): string {
    const context = relevantTables.join("\n\n");

    return [
        "You are an expert SQL assistant. Use the following database schema to write a SQL query.",
        "",
        "### Schema:",
        context,
        "",
        "### Rules:",
        "- Only return the SQL query, no explanations.",
        "- Use the table and column names exactly as defined in the schema.",
        "",
        "### Question:",
        userQuestion,
        "",
        "### SQL Query:"
    ].join("\n");
}
