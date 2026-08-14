import {bold, dim} from "./Ansi";

const visibleLength = (text : string) : number => text.replace(/\x1b\[[0-9;]*m/g, "").length;

const pad = (text : string, width : number) : string => text + " ".repeat(width - visibleLength(text));

const renderTable = (headers : Array<string>, rows : Array<Array<string>>) : string => {
    const widths = headers.map((header, column) =>
        Math.max(header.length, ...rows.map(row => visibleLength(row[column] ?? ""))));

    const renderRow = (cells : Array<string>) =>
        cells.map((cell, column) => pad(cell, widths[column])).join("   ").trimEnd();

    return [
        bold(renderRow(headers)),
        dim(widths.map(width => "─".repeat(width)).join("───")),
        ...rows.map(renderRow),
    ].join("\n");
};

export { renderTable }
